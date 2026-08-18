import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

vi.mock("./_core/sdk", () => ({
  sdk: { authenticateRequest: vi.fn() },
}));

vi.mock("./_core/heartbeat", () => ({
  updateHeartbeatJob: vi.fn(),
}));

vi.mock("./db", () => ({
  claimScheduledCallback: vi.fn(),
  completeScheduledCallback: vi.fn(),
  getScheduledJobByTaskUid: vi.fn(),
  releaseScheduledCallbackClaim: vi.fn(),
  rotateScheduledCallbackToken: vi.fn(),
}));

vi.mock("./workflowExecution", () => ({
  executeWorkflowRun: vi.fn(),
}));

import { updateHeartbeatJob } from "./_core/heartbeat";
import { sdk } from "./_core/sdk";
import { claimScheduledCallback, completeScheduledCallback, getScheduledJobByTaskUid, rotateScheduledCallbackToken } from "./db";
import { readCallbackToken, resolveScheduledCallbackToken, runScheduledWorkflow, scheduledFailureResponse } from "./scheduled";
import { executeWorkflowRun } from "./workflowExecution";

function createResponse() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  return response as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

describe("scheduled workflow callback", () => {
  const job = {
    id: "schedule-1",
    ownerId: 7,
    workflowId: "workflow-1",
    name: "Daily operational report",
    enabled: true,
    callbackToken: "abcdefghijklmnop",
    activeCallbackToken: null,
    completedCallbackToken: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({ isCron: true, taskUid: "task-1" } as never);
    vi.mocked(getScheduledJobByTaskUid).mockResolvedValue(job as never);
    vi.mocked(claimScheduledCallback).mockResolvedValue(true);
    vi.mocked(completeScheduledCallback).mockResolvedValue(true);
    vi.mocked(updateHeartbeatJob).mockResolvedValue({ nextExecutionAt: "2026-08-19T00:00:00.000Z" });
    vi.mocked(rotateScheduledCallbackToken).mockResolvedValue(true);
    vi.mocked(executeWorkflowRun).mockResolvedValue({ runId: "run-1", status: "success", output: "ok" });
  });

  it("rejects calls that are not authenticated cron invocations", async () => {
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({ isCron: false, taskUid: undefined } as never);
    const response = createResponse();

    await runScheduledWorkflow({} as Request, response);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ error: "cron-only" });
  });

  it("does not expose internal failure messages in public callback responses", () => {
    const response = scheduledFailureResponse();
    expect(response.error).toBe("scheduled-workflow-failed");
    expect(response).not.toHaveProperty("context");
    expect(response.timestamp).toEqual(expect.any(String));
  });

  it("accepts only a well-formed callback token", () => {
    expect(readCallbackToken({ callbackToken: "abcdefghijklmnop" })).toBe("abcdefghijklmnop");
    expect(readCallbackToken({ callbackToken: "short" })).toBeNull();
    expect(readCallbackToken({})).toBeNull();
  });

  it("lazily initializes a legacy job from its existing heartbeat payload", () => {
    expect(resolveScheduledCallbackToken({ jobId: "schedule-1" }, "schedule-1", null)).toEqual({ token: "legacy-schedule-1", allowUninitialized: true });
    expect(resolveScheduledCallbackToken({ jobId: "other-job" }, "schedule-1", null)).toBeNull();
  });

  it("does not execute a stale or duplicate callback token", async () => {
    const response = createResponse();
    await runScheduledWorkflow({ body: { callbackToken: "qrstuvwxyzabcdef" } } as Request, response);

    expect(response.status).toHaveBeenCalledWith(422);
    expect(executeWorkflowRun).not.toHaveBeenCalled();
    expect(claimScheduledCallback).not.toHaveBeenCalled();
  });

  it("executes a claimed callback once and rotates its heartbeat token", async () => {
    const response = createResponse();
    await runScheduledWorkflow({ body: { callbackToken: "abcdefghijklmnop" } } as Request, response);

    expect(claimScheduledCallback).toHaveBeenCalledWith("schedule-1", "abcdefghijklmnop", false);
    expect(executeWorkflowRun).toHaveBeenCalledTimes(1);
    expect(completeScheduledCallback).toHaveBeenCalledWith("schedule-1", "abcdefghijklmnop");
    expect(updateHeartbeatJob).toHaveBeenCalledWith("task-1", expect.objectContaining({ payload: expect.objectContaining({ jobId: "schedule-1" }) }), "");
    expect(rotateScheduledCallbackToken).toHaveBeenCalledWith("schedule-1", "abcdefghijklmnop", expect.any(String), "2026-08-19T00:00:00.000Z");
    expect(response.json).toHaveBeenCalledWith({ ok: true, runId: "run-1" });
  });

  it("repairs token rotation for a retry without executing the workflow twice", async () => {
    vi.mocked(getScheduledJobByTaskUid).mockResolvedValue({ ...job, completedCallbackToken: "abcdefghijklmnop" } as never);
    const response = createResponse();
    await runScheduledWorkflow({ body: { callbackToken: "abcdefghijklmnop" } } as Request, response);

    expect(executeWorkflowRun).not.toHaveBeenCalled();
    expect(claimScheduledCallback).not.toHaveBeenCalled();
    expect(updateHeartbeatJob).toHaveBeenCalledTimes(1);
    expect(response.json).toHaveBeenCalledWith({ ok: true, skipped: "duplicate" });
  });

  it("initializes a legacy job once and uses its cron session to rotate the callback payload", async () => {
    vi.mocked(getScheduledJobByTaskUid).mockResolvedValue({ ...job, callbackToken: null } as never);
    const response = createResponse();
    await runScheduledWorkflow({ body: { jobId: "schedule-1" }, headers: { cookie: "app_session_id=cron-session" } } as Request, response);

    expect(claimScheduledCallback).toHaveBeenCalledWith("schedule-1", "legacy-schedule-1", true);
    expect(executeWorkflowRun).toHaveBeenCalledTimes(1);
    expect(updateHeartbeatJob).toHaveBeenCalledWith("task-1", expect.any(Object), "cron-session");
  });
});
