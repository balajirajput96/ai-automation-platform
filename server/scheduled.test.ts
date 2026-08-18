import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

vi.mock("./_core/sdk", () => ({
  sdk: { authenticateRequest: vi.fn() },
}));

import { sdk } from "./_core/sdk";
import { runScheduledWorkflow, scheduledFailureResponse } from "./scheduled";

function createResponse() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  return response as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

describe("scheduled workflow callback", () => {
  beforeEach(() => vi.clearAllMocks());

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
});
