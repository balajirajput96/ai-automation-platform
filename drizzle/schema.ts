import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const aiAgents = mysqlTable(
  "ai_agents",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    ownerId: int("ownerId").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description").notNull(),
    status: mysqlEnum("status", ["active", "paused"]).default("active").notNull(),
    configuration: text("configuration").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ ownerIdx: index("ai_agents_owner_idx").on(table.ownerId) })
);

export const workflows = mysqlTable(
  "workflows",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    ownerId: int("ownerId").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description").notNull(),
    triggerType: mysqlEnum("triggerType", ["scheduled", "event"]).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ ownerIdx: index("workflows_owner_idx").on(table.ownerId) })
);

export const workflowSteps = mysqlTable(
  "workflow_steps",
  {
    id: int("id").autoincrement().primaryKey(),
    workflowId: varchar("workflowId", { length: 32 }).notNull(),
    position: int("position").notNull(),
    label: varchar("label", { length: 140 }).notNull(),
    action: varchar("action", { length: 80 }).notNull(),
    configuration: text("configuration").notNull(),
  },
  table => ({ workflowIdx: index("workflow_steps_workflow_idx").on(table.workflowId) })
);

export const workflowStepRuns = mysqlTable(
  "workflow_step_runs",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    workflowRunId: varchar("workflowRunId", { length: 32 }).notNull(),
    workflowStepId: int("workflowStepId").notNull(),
    status: mysqlEnum("status", ["success", "error", "running"]).notNull(),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
    durationMs: int("durationMs"),
    output: text("output"),
  },
  table => ({ workflowRunIdx: index("workflow_step_runs_workflow_run_idx").on(table.workflowRunId) })
);

export const projects = mysqlTable(
  "projects",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    ownerId: int("ownerId").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description").notNull(),
    status: mysqlEnum("status", ["planning", "active", "paused", "complete"])
      .default("planning")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ ownerIdx: index("projects_owner_idx").on(table.ownerId) })
);

export const projectAgentLinks = mysqlTable(
  "project_agent_links",
  {
    projectId: varchar("projectId", { length: 32 }).notNull(),
    agentId: varchar("agentId", { length: 32 }).notNull(),
  },
  table => ({ pk: primaryKey({ columns: [table.projectId, table.agentId] }) })
);

export const projectWorkflowLinks = mysqlTable(
  "project_workflow_links",
  {
    projectId: varchar("projectId", { length: 32 }).notNull(),
    workflowId: varchar("workflowId", { length: 32 }).notNull(),
  },
  table => ({ pk: primaryKey({ columns: [table.projectId, table.workflowId] }) })
);

export const integrations = mysqlTable(
  "integrations",
  {
    id: varchar("id", { length: 56 }).primaryKey(),
    ownerId: int("ownerId").notNull(),
    name: mysqlEnum("name", ["GitHub", "Google", "Gemini", "Hugging Face"]).notNull(),
    authState: mysqlEnum("authState", ["connected", "not_configured", "unavailable"])
      .default("not_configured")
      .notNull(),
    permissionState: mysqlEnum("permissionState", ["granted", "limited", "not_granted"])
      .default("not_granted")
      .notNull(),
    apiKeyConfigured: boolean("apiKeyConfigured").default(false).notNull(),
    lastCheckedAt: timestamp("lastCheckedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ ownerNameIdx: uniqueIndex("integrations_owner_name_idx").on(table.ownerId, table.name) })
);

export const executionRuns = mysqlTable(
  "execution_runs",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    ownerId: int("ownerId").notNull(),
    sourceType: mysqlEnum("sourceType", ["agent", "workflow", "scheduled_job"]).notNull(),
    sourceId: varchar("sourceId", { length: 32 }),
    label: varchar("label", { length: 160 }).notNull(),
    status: mysqlEnum("status", ["success", "error", "running"]).notNull(),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
    durationMs: int("durationMs"),
    logOutput: text("logOutput"),
  },
  table => ({ ownerStartedIdx: index("execution_runs_owner_started_idx").on(table.ownerId, table.startedAt) })
);

export const scheduledJobs = mysqlTable(
  "scheduled_jobs",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    ownerId: int("ownerId").notNull(),
    workflowId: varchar("workflowId", { length: 32 }),
    name: varchar("name", { length: 120 }).notNull(),
    cronExpression: varchar("cronExpression", { length: 100 }).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    lastRunAt: timestamp("lastRunAt"),
    nextRunAt: timestamp("nextRunAt"),
    scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    ownerIdx: index("scheduled_jobs_owner_idx").on(table.ownerId),
    taskUidIdx: index("scheduled_jobs_task_uid_idx").on(table.scheduleCronTaskUid),
  })
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
