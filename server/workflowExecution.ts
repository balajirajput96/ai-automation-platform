import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { executionRuns, workflowStepRuns, workflowSteps, workflows } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";
import { requireOperationsDb } from "./db";

export type WorkflowAction = "operation" | "llm";

export type StepConfiguration = {
  delayMs?: number;
  fail?: boolean;
  maxAttempts?: number;
  message?: string;
  model?: "gpt-5-mini" | "claude-haiku-4-5" | "gemini-3-flash-preview";
  prompt?: string;
};

export function parseStepConfiguration(raw: string): StepConfiguration {
  try {
    const parsed = JSON.parse(raw) as StepConfiguration;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("must be an object");
    if (parsed.delayMs !== undefined && (!Number.isInteger(parsed.delayMs) || parsed.delayMs < 0 || parsed.delayMs > 5_000)) throw new Error("delayMs must be an integer between 0 and 5000");
    if (parsed.maxAttempts !== undefined && (!Number.isInteger(parsed.maxAttempts) || parsed.maxAttempts < 1 || parsed.maxAttempts > 3)) throw new Error("maxAttempts must be an integer between 1 and 3");
    if (parsed.model !== undefined && !["gpt-5-mini", "claude-haiku-4-5", "gemini-3-flash-preview"].includes(parsed.model)) throw new Error("Unsupported model");
    if (parsed.prompt !== undefined && (typeof parsed.prompt !== "string" || parsed.prompt.length > 8_000)) throw new Error("prompt must be a string up to 8000 characters");
    return parsed;
  } catch (error) {
    throw new Error(error instanceof Error && error.message !== "Unexpected token '}'" ? `Invalid workflow step configuration: ${error.message}` : "Workflow step configuration must be valid JSON");
  }
}

export async function executeWithRetries<T>(operation: () => Promise<T>, maxAttempts: number): Promise<{ value: T; attempts: number }> {
  let lastError: unknown;
  for (let attempts = 1; attempts <= maxAttempts; attempts += 1) {
    try {
      return { value: await operation(), attempts };
    } catch (error) {
      lastError = error;
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`${message} after ${maxAttempts} attempt${maxAttempts === 1 ? "" : "s"}`);
}

export async function executeWorkflowStep(step: typeof workflowSteps.$inferSelect): Promise<string> {
  const action = step.action as WorkflowAction;
  const configuration = parseStepConfiguration(step.configuration);
  if (configuration.fail === true) throw new Error(`Step configured to fail: ${step.label}`);
  if (configuration.delayMs) await new Promise(resolve => setTimeout(resolve, configuration.delayMs));
  if (action === "operation") return configuration.message?.trim() || `Completed deterministic operation: ${step.label}`;
  if (action !== "llm") throw new Error(`Unsupported workflow action: ${step.action}`);

  const response = await invokeLLM({
    model: configuration.model ?? "gpt-5-mini",
    maxTokens: 1_200,
    messages: [
      { role: "system", content: "You are an execution step inside an audited AI operations platform. Return a concise, directly usable result. Do not claim to perform external actions." },
      { role: "user", content: configuration.prompt?.trim() || step.label },
    ],
  });
  const content = response.choices[0]?.message.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("AI action returned no usable text");
  return content.slice(0, 8_000);
}

export async function executeWorkflowRun(input: { ownerId: number; workflowId: string; runLabel?: string }) {
  const db = await requireOperationsDb();
  const [workflow] = await db.select().from(workflows).where(and(eq(workflows.id, input.workflowId), eq(workflows.ownerId, input.ownerId))).limit(1);
  if (!workflow) throw new Error("Workflow not found");
  if (!workflow.enabled) throw new Error("Workflow is disabled");
  const steps = await db.select().from(workflowSteps).where(eq(workflowSteps.workflowId, workflow.id)).orderBy(workflowSteps.position);
  if (!steps.length) throw new Error("Workflow has no executable steps");

  const runId = nanoid();
  const startedAt = new Date();
  await db.insert(executionRuns).values({
    id: runId,
    ownerId: input.ownerId,
    sourceType: "workflow",
    sourceId: workflow.id,
    label: input.runLabel?.trim() || workflow.name,
    status: "running",
    startedAt,
    logOutput: "Workflow execution started.",
  });

  let activeStep: { id: string; startedAt: Date } | null = null;
  const output: string[] = [];
  try {
    for (const step of steps) {
      const stepRunId = nanoid();
      const stepStartedAt = new Date();
      activeStep = { id: stepRunId, startedAt: stepStartedAt };
      await db.insert(workflowStepRuns).values({ id: stepRunId, workflowRunId: runId, workflowStepId: step.id, status: "running", startedAt: stepStartedAt });
      const maxAttempts = parseStepConfiguration(step.configuration).maxAttempts ?? 1;
      const { value: result, attempts } = await executeWithRetries(() => executeWorkflowStep(step), maxAttempts);
      const completedAt = new Date();
      await db.update(workflowStepRuns).set({ status: "success", completedAt, durationMs: completedAt.getTime() - stepStartedAt.getTime(), output: result }).where(eq(workflowStepRuns.id, stepRunId));
      output.push(`Step ${step.position + 1} · ${step.label}${attempts > 1 ? ` (succeeded on attempt ${attempts})` : ""}\n${result}`);
      activeStep = null;
    }
    const completedAt = new Date();
    const logOutput = output.join("\n\n");
    await db.update(executionRuns).set({ status: "success", completedAt, durationMs: completedAt.getTime() - startedAt.getTime(), logOutput }).where(eq(executionRuns.id, runId));
    return { runId, status: "success" as const, output: logOutput };
  } catch (error) {
    const completedAt = new Date();
    const message = error instanceof Error ? error.message : String(error);
    if (activeStep) await db.update(workflowStepRuns).set({ status: "error", completedAt, durationMs: completedAt.getTime() - activeStep.startedAt.getTime(), output: message }).where(eq(workflowStepRuns.id, activeStep.id));
    await db.update(executionRuns).set({ status: "error", completedAt, durationMs: completedAt.getTime() - startedAt.getTime(), logOutput: message }).where(eq(executionRuns.id, runId));
    throw error;
  }
}
