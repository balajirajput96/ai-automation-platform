import { describe, expect, it } from "vitest";
import { executeWorkflowStep } from "./workflowExecution";

describe("built-in AI workflow action", () => {
  it("returns a usable result from the configured project AI service", async () => {
    const result = await executeWorkflowStep({
      id: 1,
      workflowId: "live-contract",
      position: 0,
      label: "Reply with the exact words: AstraFlow AI ready",
      action: "llm",
      configuration: '{"model":"gpt-5-mini"}',
    });
    expect(result).toContain("AstraFlow");
    expect(result.trim().length).toBeGreaterThan(4);
  }, 60_000);
});
