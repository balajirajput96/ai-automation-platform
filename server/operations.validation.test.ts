import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAuthenticatedContext(): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "operations-test-user",
      name: "Operations Test User",
      email: "test@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("AI operations input contracts", () => {
  it("rejects execution-log pagination outside the supported range", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    await expect(caller.operations.runs({ page: 0, pageSize: 8 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects agent status labels outside active and paused", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    await expect(caller.agents.setStatus({ id: "agent-1", status: "running" as "active" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects workflow trigger labels outside scheduled and event", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    await expect(caller.workflows.create({
      name: "Invalid trigger workflow",
      description: "Must reject unsupported trigger labels.",
      triggerType: "manual" as "scheduled",
      steps: [{ label: "First step", action: "operation", configuration: "{}" }],
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires six cron fields for scheduled jobs", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    await expect(caller.schedules.create({ name: "Invalid schedule", cronExpression: "0 9 * * *" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
