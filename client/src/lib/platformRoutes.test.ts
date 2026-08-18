import { describe, expect, it } from "vitest";
import { platformRoutes } from "./platformRoutes";

describe("platform routes", () => {
  it("keeps both execution-log paths available", () => {
    expect(platformRoutes.executionLogs).toBe("/runs");
    expect(platformRoutes.executionLogsAlias).toBe("/logs");
  });
});
