import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  aiAgents,
  executionRuns,
  InsertUser,
  integrations,
  projectAgentLinks,
  projects,
  projectWorkflowLinks,
  scheduledJobs,
  users,
  workflowSteps,
  workflows,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { inspectIntegration, type IntegrationName } from "./integrationHealth";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function requireOperationsDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

const integrationNames = ["GitHub", "Google", "Gemini", "Hugging Face"] as const;

export async function ensureIntegrationCatalog(ownerId: number) {
  const db = await requireOperationsDb();
  await Promise.all(
    integrationNames.map(name =>
      db
        .insert(integrations)
        .values({ id: `int-${ownerId}-${name.replace(/\s/g, "-").toLowerCase()}`, ownerId, name })
        .onDuplicateKeyUpdate({ set: { updatedAt: new Date() } })
    )
  );
  const current = await db.select().from(integrations).where(eq(integrations.ownerId, ownerId));
  const staleBefore = Date.now() - 5 * 60 * 1_000;
  await Promise.all(
    current.filter(item => !item.lastCheckedAt || item.lastCheckedAt.getTime() < staleBefore).map(async item => {
      const health = await inspectIntegration(item.name as IntegrationName);
      await db.update(integrations).set({ authState: health.authState, permissionState: health.permissionState, apiKeyConfigured: health.apiKeyConfigured, lastCheckedAt: health.checkedAt, updatedAt: new Date() }).where(eq(integrations.id, item.id));
    })
  );
  return db.select().from(integrations).where(eq(integrations.ownerId, ownerId));
}

export async function getWorkflowSteps(workflowIds: string[]) {
  if (workflowIds.length === 0) return [];
  const db = await requireOperationsDb();
  return db
    .select()
    .from(workflowSteps)
    .where(inArray(workflowSteps.workflowId, workflowIds))
    .orderBy(workflowSteps.position);
}

export async function getOperationsOverview(ownerId: number) {
  const db = await requireOperationsDb();
  const [agents, workflowRows, integrationsRows, recentRuns, scheduledJobRows] = await Promise.all([
    db.select().from(aiAgents).where(eq(aiAgents.ownerId, ownerId)),
    db.select().from(workflows).where(eq(workflows.ownerId, ownerId)),
    ensureIntegrationCatalog(ownerId),
    db
      .select()
      .from(executionRuns)
      .where(eq(executionRuns.ownerId, ownerId))
      .orderBy(desc(executionRuns.startedAt))
      .limit(6),
    db.select().from(scheduledJobs).where(eq(scheduledJobs.ownerId, ownerId)),
  ]);

  return {
    activeAgents: agents.filter(agent => agent.status === "active").length,
    totalAgents: agents.length,
    enabledWorkflows: workflowRows.filter(workflow => workflow.enabled).length,
    totalWorkflows: workflowRows.length,
    connectedIntegrations: integrationsRows.filter(item => item.authState === "connected").length,
    totalIntegrations: integrationsRows.length,
    enabledScheduledJobs: scheduledJobRows.filter(job => job.enabled).length,
    integrations: integrationsRows,
    recentRuns,
  };
}

export async function getPagedRuns(ownerId: number, page: number, pageSize: number, sourceId?: string) {
  const db = await requireOperationsDb();
  const where = sourceId
    ? and(eq(executionRuns.ownerId, ownerId), eq(executionRuns.sourceId, sourceId))
    : eq(executionRuns.ownerId, ownerId);
  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(executionRuns).where(where);
  const items = await db
    .select()
    .from(executionRuns)
    .where(where)
    .orderBy(desc(executionRuns.startedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return { items, total: Number(total) };
}

export async function replaceProjectLinks(
  ownerId: number,
  projectId: string,
  agentIds: string[],
  workflowIds: string[]
) {
  const db = await requireOperationsDb();
  if (agentIds.length) {
    const validAgents = await db
      .select({ id: aiAgents.id })
      .from(aiAgents)
      .where(and(eq(aiAgents.ownerId, ownerId), inArray(aiAgents.id, agentIds)));
    if (validAgents.length !== new Set(agentIds).size) throw new Error("One or more linked agents are not available");
  }
  if (workflowIds.length) {
    const validWorkflows = await db
      .select({ id: workflows.id })
      .from(workflows)
      .where(and(eq(workflows.ownerId, ownerId), inArray(workflows.id, workflowIds)));
    if (validWorkflows.length !== new Set(workflowIds).size) throw new Error("One or more linked workflows are not available");
  }
  await db.delete(projectAgentLinks).where(eq(projectAgentLinks.projectId, projectId));
  await db.delete(projectWorkflowLinks).where(eq(projectWorkflowLinks.projectId, projectId));
  if (agentIds.length) await db.insert(projectAgentLinks).values(agentIds.map(agentId => ({ projectId, agentId })));
  if (workflowIds.length) await db.insert(projectWorkflowLinks).values(workflowIds.map(workflowId => ({ projectId, workflowId })));
}

export async function listProjectsWithLinks(ownerId: number) {
  const db = await requireOperationsDb();
  const projectRows = await db.select().from(projects).where(eq(projects.ownerId, ownerId));
  if (!projectRows.length) return [];
  const projectIds = projectRows.map(project => project.id);
  const [agentLinks, workflowLinks] = await Promise.all([
    db.select().from(projectAgentLinks).where(inArray(projectAgentLinks.projectId, projectIds)),
    db.select().from(projectWorkflowLinks).where(inArray(projectWorkflowLinks.projectId, projectIds)),
  ]);
  return projectRows.map(project => ({
    ...project,
    agentIds: agentLinks.filter(link => link.projectId === project.id).map(link => link.agentId),
    workflowIds: workflowLinks.filter(link => link.projectId === project.id).map(link => link.workflowId),
  }));
}

export async function getScheduledJobByTaskUid(taskUid: string) {
  const db = await requireOperationsDb();
  const [job] = await db.select().from(scheduledJobs).where(eq(scheduledJobs.scheduleCronTaskUid, taskUid)).limit(1);
  return job;
}
