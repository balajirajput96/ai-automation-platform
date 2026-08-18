export type IntegrationName = "GitHub" | "Google" | "Gemini" | "Hugging Face";

export type IntegrationHealth = {
  authState: "connected" | "not_configured" | "unavailable";
  permissionState: "granted" | "limited" | "not_granted";
  apiKeyConfigured: boolean;
  checkedAt: Date;
};

const timeoutSignal = () => AbortSignal.timeout(5_000);

const notConfigured = (): IntegrationHealth => ({
  authState: "not_configured",
  permissionState: "not_granted",
  apiKeyConfigured: false,
  checkedAt: new Date(),
});

const unavailable = (apiKeyConfigured: boolean): IntegrationHealth => ({
  authState: "unavailable",
  permissionState: "not_granted",
  apiKeyConfigured,
  checkedAt: new Date(),
});

const connected = (permissionState: "granted" | "limited" = "granted"): IntegrationHealth => ({
  authState: "connected",
  permissionState,
  apiKeyConfigured: true,
  checkedAt: new Date(),
});

async function checkGitHub(token: string): Promise<IntegrationHealth> {
  const actionRepository = process.env.GITHUB_REPOSITORY;
  const repositoryPath = actionRepository && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(actionRepository)
    ? `/repos/${actionRepository}`
    : "/user";
  const response = await fetch(`https://api.github.com${repositoryPath}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
    signal: timeoutSignal(),
  });
  if (!response.ok) return unavailable(true);
  const scopes = response.headers.get("x-oauth-scopes")?.split(",").filter(Boolean) ?? [];
  return connected(scopes.length === 0 || scopes.includes("repo") ? "granted" : "limited");
}

async function checkGoogle(token: string): Promise<IntegrationHealth> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${token}` },
    signal: timeoutSignal(),
  });
  if (!response.ok) return unavailable(true);
  const scopes = response.headers.get("x-oauth-scopes")?.split(" ").filter(Boolean) ?? [];
  return connected(scopes.length === 0 ? "limited" : "granted");
}

async function checkGemini(apiKey: string): Promise<IntegrationHealth> {
  const endpoint = new URL("https://generativelanguage.googleapis.com/v1beta/models");
  endpoint.searchParams.set("key", apiKey);
  const response = await fetch(endpoint, { signal: timeoutSignal() });
  return response.ok ? connected("granted") : unavailable(true);
}

async function checkHuggingFace(token: string): Promise<IntegrationHealth> {
  const response = await fetch("https://huggingface.co/api/whoami-v2", {
    headers: { authorization: `Bearer ${token}` },
    signal: timeoutSignal(),
  });
  return response.ok ? connected("granted") : unavailable(true);
}

/**
 * Probes only credentials explicitly configured on the server. When no
 * credential exists, the response is deliberately `not_configured` rather
 * than a fabricated connected state.
 */
export async function inspectIntegration(name: IntegrationName): Promise<IntegrationHealth> {
  try {
    if (name === "GitHub") {
      const token = process.env.GITHUB_TOKEN;
      return token ? await checkGitHub(token) : notConfigured();
    }
    if (name === "Google") {
      const token = process.env.GOOGLE_ACCESS_TOKEN;
      return token ? await checkGoogle(token) : notConfigured();
    }
    if (name === "Gemini") {
      const apiKey = process.env.GEMINI_API_KEY;
      return apiKey ? await checkGemini(apiKey) : notConfigured();
    }
    // Hugging Face is intentionally inactive for this release. Do not probe or
    // attempt to use a stored credential unless the user explicitly re-enables it.
    return notConfigured();
  } catch {
    const configured = name === "GitHub" ? Boolean(process.env.GITHUB_TOKEN) : name === "Google" ? Boolean(process.env.GOOGLE_ACCESS_TOKEN) : name === "Gemini" ? Boolean(process.env.GEMINI_API_KEY) : false;
    return unavailable(configured);
  }
}
