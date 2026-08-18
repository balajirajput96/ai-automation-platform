import type { Request, Response } from "express";
import { parse as parseCookie } from "cookie";
import { nanoid } from "nanoid";
import { sdk } from "./_core/sdk";
import { updateHeartbeatJob } from "./_core/heartbeat";
import { COOKIE_NAME } from "../shared/const";
import {
  claimScheduledCallback,
  completeScheduledCallback,
  getScheduledJobByTaskUid,
  releaseScheduledCallbackClaim,
  rotateScheduledCallbackToken,
} from "./db";
import { executeWorkflowRun } from "./workflowExecution";

export function scheduledFailureResponse() {
  return { error: "scheduled-workflow-failed", timestamp: new Date().toISOString() };
}

export function readCallbackToken(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const token = (body as Record<string, unknown>).callbackToken;
  return typeof token === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(token) ? token : null;
}

function legacyCallbackToken(jobId: string): string {
  return `legacy-${jobId}`;
}

export function resolveScheduledCallbackToken(body: unknown, jobId: string, persistedToken: string | null): { token: string; allowUninitialized: boolean } | null {
  const suppliedToken = readCallbackToken(body);
  if (persistedToken) return suppliedToken === persistedToken ? { token: persistedToken, allowUninitialized: false } : null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if ((body as Record<string, unknown>).jobId !== jobId) return null;
  return { token: legacyCallbackToken(jobId), allowUninitialized: true };
}

export async function runScheduledWorkflow(req: Request, res: Response) {
  let claimedJob: { id: string; callbackToken: string } | null = null;
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const job = await getScheduledJobByTaskUid(user.taskUid);
    if (!job) return res.json({ ok: true, skipped: "orphan" });
    if (!job.enabled) return res.json({ ok: true, skipped: "disabled" });
    if (!job.workflowId) return res.status(422).json({ error: "Scheduled job requires a linked workflow" });
    const callback = resolveScheduledCallbackToken(req.body, job.id, job.callbackToken);
    if (!callback) {
      return res.status(422).json({ error: "Scheduled callback token is invalid or expired" });
    }
    const { token: callbackToken, allowUninitialized } = callback;
    const sessionToken = parseCookie(req.headers?.cookie ?? "")[COOKIE_NAME] ?? "";

    if (job.completedCallbackToken === callbackToken) {
      const nextCallbackToken = nanoid();
      const heartbeat = await updateHeartbeatJob(user.taskUid, { payload: { jobId: job.id, callbackToken: nextCallbackToken } }, sessionToken);
      await rotateScheduledCallbackToken(job.id, callbackToken, nextCallbackToken, heartbeat.nextExecutionAt);
      return res.json({ ok: true, skipped: "duplicate" });
    }

    const claimed = await claimScheduledCallback(job.id, callbackToken, allowUninitialized);
    if (!claimed) return res.json({ ok: true, skipped: "in-progress-or-duplicate" });
    claimedJob = { id: job.id, callbackToken };

    const result = await executeWorkflowRun({ ownerId: job.ownerId, workflowId: job.workflowId, runLabel: `${job.name} · scheduled` });
    const completed = await completeScheduledCallback(job.id, callbackToken);
    if (!completed) throw new Error("Scheduled callback completion claim was lost");
    claimedJob = null;
    const nextCallbackToken = nanoid();
    const heartbeat = await updateHeartbeatJob(user.taskUid, { payload: { jobId: job.id, callbackToken: nextCallbackToken } }, sessionToken);
    const rotated = await rotateScheduledCallbackToken(job.id, callbackToken, nextCallbackToken, heartbeat.nextExecutionAt);
    if (!rotated) throw new Error("Scheduled callback token rotation was not persisted");
    return res.json({ ok: true, runId: result.runId });
  } catch (error) {
    if (claimedJob) await releaseScheduledCallbackClaim(claimedJob.id, claimedJob.callbackToken).catch(() => undefined);
    console.error("[Scheduled workflow] Execution failed", error);
    return res.status(500).json(scheduledFailureResponse());
  }
}
