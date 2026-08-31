import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inspectIntegration, isSandboxProxy } from "./integrationHealth";

const originalGitHubToken = process.env.GITHUB_TOKEN;
const originalGitHubRepository = process.env.GITHUB_REPOSITORY;
const originalSandboxProxy = process.env.SANDBOX_PROXY_GITHUB_PROXY;

describe("inspectIntegration", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    // Clear sandbox proxy env var for tests
    delete process.env.SANDBOX_PROXY_GITHUB_PROXY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalGitHubToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = originalGitHubToken;
    if (originalGitHubRepository === undefined) delete process.env.GITHUB_REPOSITORY;
    else process.env.GITHUB_REPOSITORY = originalGitHubRepository;
    if (originalSandboxProxy === undefined) delete process.env.SANDBOX_PROXY_GITHUB_PROXY;
    else process.env.SANDBOX_PROXY_GITHUB_PROXY = originalSandboxProxy;
  });

  it("uses the current repository endpoint for a GitHub Actions token", async () => {
    process.env.GITHUB_TOKEN = "actions-token";
    process.env.GITHUB_REPOSITORY = "balajirajput96/ai-automation-platform";
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 200 }));

    await expect(inspectIntegration("GitHub")).resolves.toMatchObject({
      authState: "connected",
      permissionState: "granted",
      apiKeyConfigured: true,
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/balajirajput96/ai-automation-platform",
      expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer actions-token" }) }),
    );
  });
});
