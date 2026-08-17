import { describe, expect, it } from "vitest";
import { inspectIntegration } from "./integrationHealth";

describe("configured provider credentials", () => {
  it("validates Gemini through its lightweight authenticated health endpoint", async () => {
    const health = await inspectIntegration("Gemini");
    expect(health.apiKeyConfigured).toBe(true);
    expect(health.authState).toBe("connected");
    expect(["granted", "limited"]).toContain(health.permissionState);
  }, 15_000);

  it("keeps Hugging Face inactive without calling its provider endpoint", async () => {
    await expect(inspectIntegration("Hugging Face")).resolves.toMatchObject({
      authState: "not_configured",
      permissionState: "not_granted",
      apiKeyConfigured: false,
    });
  });
});
