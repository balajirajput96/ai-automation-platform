import { describe, expect, it } from "vitest";
import { executeWithRetries, parseStepConfiguration } from "./workflowExecution";

describe("workflow retry policy", () => {
  it("retries a transient operation and reports the successful attempt", async () => {
    let calls = 0;
    const result = await executeWithRetries(async () => {
      calls += 1;
      if (calls < 2) throw new Error("temporary provider error");
      return "completed";
    }, 3);

    expect(result).toEqual({ value: "completed", attempts: 2 });
    expect(calls).toBe(2);
  });

  it("stops after the configured bounded attempt count", async () => {
    let calls = 0;
    await expect(executeWithRetries(async () => {
      calls += 1;
      throw new Error("persistent provider error");
    }, 3)).rejects.toThrow("after 3 attempts");
    expect(calls).toBe(3);
  });

  it("rejects retry counts outside the safe range", () => {
    expect(() => parseStepConfiguration('{"maxAttempts":4}')).toThrow("maxAttempts must be an integer between 1 and 3");
  });
});
