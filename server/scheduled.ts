import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { executionRuns, scheduledJobs, workflowStepRuns, workflowSteps, workflows } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { getScheduledJobByTaskUid, requireOperationsDb } from "./db";

type StepConfiguration = { delayMs?: number; fail?: boolean; message?: string };

function parseStepConfiguration(raw: string): StepConfiguration {
  try {
    const parsed = JSON.parse(raw) as StepConfiguration;
    if (!parsed || typeof parsed !== "object") throw new Error("must be an object");
    return parsed;
  } catch {
    throw new Error("Workflow step configuration must be valid JSON");
  }
}

async function executeWorkflowStep(step: typeof workflowSteps.$inferSelect): Promise<string> {
  if (step.action !== "operation") throw new Error(`Unsupported workflow action: ${step.action}`);
  const configuration = parseStepConfiguration(step.configuration);
  if (configuration.fail === true) throw new Error(`Step configured to fail: ${step.label}`);
  if (configuration.delayMs !== undefined) {
    if (!Number.isInteger(configuration.delayMs) || configuration.delayMs < 0 || configuration.delayMs > 5_000) throw new Error("delayMs must be an integer between 0 and 5000");
    await new Promise(resolve => setTimeout(resolve, configuration.delayMs));
  }
  return configuration.message?.trim() || `Completed operation: ${step.label}`;
}

export async function runScheduledWorkflow(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const job = await getScheduledJobByTaskUid(user.taskUid);
    if (!job) return res.json({ ok: true, skipped: "orphan" });
    if (!job.enabled) return res.json({ ok: true, skipped: "disabled" });

    const db = await requireOperationsDb();
    const runId = nanoid();
    const startedAt = new Date();
    let label = job.name;
    let output = "Scheduled job completed with no linked workflow.";
    let sourceId = job.id;
    let sourceType: "workflow" | "scheduled_job" = "scheduled_job";
    if (job.workflowId) {
      const [workflow] = await db.select().from(workflows).where(eq(workflows.id, job.workflowId)).limit(1);
      if (!workflow) throw new Error("Linked workflow no longer exists");
      if (!workflow.enabled) return res.json({ ok: true, skipped: "workflow-disabled" });
      const steps = await db.select().from(workflowSteps).where(eq(workflowSteps.workflowId, workflow.id)).orderBy(workflowSteps.position);
      if (!steps.length) throw new Error("Linked workflow has no executable steps");
      label = workflow.name;
      sourceId = workflow.id;
      sourceType = "workflow";
      output = `Executed ${steps.length} declared workflow step${steps.length === 1 ? "" : "s"}: ${steps.map(step => step.label).join(" → ")}. Provider-backed actions remain gated until the corresponding integration is authorized.`;
    }
    await db.insert(executionRuns).values({ id: runId, ownerId: job.ownerId, sourceType, sourceId, label, status: "running", startedAt, logOutput: "Scheduled trigger accepted; workflow execution started." });
    let activeStepRunId: string | null = null;
    try {
      if (job.workflowId) {
        const steps = await db.select().from(workflowSteps).where(eq(workflowSteps.workflowId, job.workflowId)).orderBy(workflowSteps.position);
        const completedSteps: string[] = [];
        for (const step of steps) {
          activeStepRunId = nanoid();
          const stepStartedAt = new Date();
          await db.insert(workflowStepRuns).values({ id: activeStepRunId, workflowRunId: runId, workflowStepId: step.id, status: "running", startedAt: stepStartedAt });
          const stepOutput = await executeWorkflowStep(step);
          const stepCompletedAt = new Date();
          await db.update(workflowStepRuns).set({ status: "success", completedAt: stepCompletedAt, durationMs: stepCompletedAt.getTime() - stepStartedAt.getTime(), output: stepOutput }).where(eq(workflowStepRuns.id, activeStepRunId));
          completedSteps.push(stepOutput);
          activeStepRunId = null;
        }
        output = completedSteps.join("\n");
      }
      const completedAt = new Date();
      await db.update(executionRuns).set({ status: "success", completedAt, durationMs: completedAt.getTime() - startedAt.getTime(), logOutput: output }).where(eq(executionRuns.id, runId));
      await db.update(scheduledJobs).set({ lastRunAt: completedAt, updatedAt: completedAt }).where(eq(scheduledJobs.id, job.id));
      return res.json({ ok: true, runId });
    } catch (error) {
      const completedAt = new Date();
      const message = error instanceof Error ? error.message : String(error);
      if (activeStepRunId) await db.update(workflowStepRuns).set({ status: "error", completedAt, durationMs: completedAt.getTime() - startedAt.getTime(), output: message }).where(eq(workflowStepRuns.id, activeStepRunId));
      await db.update(executionRuns).set({ status: "error", completedAt, durationMs: completedAt.getTime() - startedAt.getTime(), logOutput: message }).where(eq(executionRuns.id, runId));
      await db.update(scheduledJobs).set({ lastRunAt: completedAt, updatedAt: completedAt }).where(eq(scheduledJobs.id, job.id));
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message, context: { url: req.originalUrl }, timestamp: new Date().toISOString() });
  }
}
