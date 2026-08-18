import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { scheduledJobs } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { getScheduledJobByTaskUid, requireOperationsDb } from "./db";
import { executeWorkflowRun } from "./workflowExecution";

export function scheduledFailureResponse() {
  return { error: "scheduled-workflow-failed", timestamp: new Date().toISOString() };
}

export async function runScheduledWorkflow(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const job = await getScheduledJobByTaskUid(user.taskUid);
    if (!job) return res.json({ ok: true, skipped: "orphan" });
    if (!job.enabled) return res.json({ ok: true, skipped: "disabled" });
    if (!job.workflowId) return res.status(422).json({ error: "Scheduled job requires a linked workflow" });

    const result = await executeWorkflowRun({ ownerId: job.ownerId, workflowId: job.workflowId, runLabel: `${job.name} · scheduled` });
    const db = await requireOperationsDb();
    await db.update(scheduledJobs).set({ lastRunAt: new Date(), updatedAt: new Date() }).where(eq(scheduledJobs.id, job.id));
    return res.json({ ok: true, runId: result.runId });
  } catch (error) {
    console.error("[Scheduled workflow] Execution failed", error);
    return res.status(500).json(scheduledFailureResponse());
  }
}
