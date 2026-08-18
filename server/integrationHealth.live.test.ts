import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inspectIntegration } from "./integrationHealth";

const originalGitHubToken = process.env.GITHUB_TOKEN;
const githubHealthToken = process.env.CI ? process.env.ASTRAFLOW_LIVE_GITHUB_TOKEN : process.env.GITHUB_TOKEN;
const hasGitHubCredential = Boolean(githubHealthToken);
const hasGeminiCredential = Boolean(process.env.GEMINI_API_KEY);

describe("configured provider credentials", () => {
  beforeAll(() => {
    if (githubHealthToken) process.env.GITHUB_TOKEN = githubHealthToken;
  });

  afterAll(() => {
    if (originalGitHubToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = originalGitHubToken;
  });

  it.skipIf(!hasGitHubCredential)("validates GitHub through its lightweight authenticated health endpoint", async () => {
    const health = await inspectIntegration("GitHub");
    expect(health.apiKeyConfigured).toBe(true);
    expect(health.authState).toBe("connected");
    expect(["granted", "limited"]).toContain(health.permissionState);
  }, 15_000);

  it.skipIf(!hasGeminiCredential)("validates Gemini through its lightweight authenticated health endpoint", async () => {
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
