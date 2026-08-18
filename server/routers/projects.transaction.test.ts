import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({
  listProjectsWithLinks: vi.fn(),
  replaceProjectLinks: vi.fn(),
  requireOperationsDb: vi.fn(),
}));

import { listProjectsWithLinks, replaceProjectLinks, requireOperationsDb } from "../db";
import { projectsRouter } from "./projects";
import type { TrpcContext } from "../_core/context";

function createContext(): TrpcContext {
  return {
    user: {
      id: 21,
      openId: "project-transaction-user",
      name: "Project Test User",
      email: "project@example.com",
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

describe("projects.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes the project and resource links within the same transaction", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn(() => ({ values }));
    const transaction = vi.fn(async callback => callback({ insert }));
    vi.mocked(requireOperationsDb).mockResolvedValue({ transaction } as never);

    const caller = projectsRouter.createCaller(createContext());
    const result = await caller.create({
      title: "Atomic project",
      description: "A project whose links must not survive a failed write.",
      status: "active",
      agentIds: ["agent-1"],
      workflowIds: ["workflow-1"],
    });

    expect(result.id).toEqual(expect.any(String));
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(replaceProjectLinks).toHaveBeenCalledWith(21, result.id, ["agent-1"], ["workflow-1"], expect.objectContaining({ insert }));
    expect(listProjectsWithLinks).not.toHaveBeenCalled();
  });
});
