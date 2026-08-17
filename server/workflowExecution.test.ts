import { describe, expect, it } from "vitest";
import { parseStepConfiguration } from "./workflowExecution";

describe("workflow action configuration", () => {
  it("accepts a supported AI model and bounded delay", () => {
    expect(parseStepConfiguration('{"model":"gpt-5-mini","delayMs":250,"prompt":"Summarize the input"}')).toEqual({
      model: "gpt-5-mini",
      delayMs: 250,
      prompt: "Summarize the input",
    });
  });

  it("rejects unsupported model identifiers before an action runs", () => {
    expect(() => parseStepConfiguration('{"model":"unknown-model"}')).toThrow("Unsupported model");
  });

  it("rejects delays outside the runtime safety limit", () => {
    expect(() => parseStepConfiguration('{"delayMs":6000}')).toThrow("delayMs must be an integer between 0 and 5000");
  });

  it("rejects malformed action configuration", () => {
    expect(() => parseStepConfiguration("not-json")).toThrow("Invalid workflow step configuration");
  });
});
