import { executionRuns, workflowSteps, workflows } from "../../drizzle/schema";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getWorkflowSteps, requireOperationsDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { executeWorkflowRun } from "../workflowExecution";

const stepInput = z.object({ label: z.string().trim().min(2).max(140), action: z.enum(["operation", "llm"]), configuration: z.string().trim().max(8000).default("{}") });

export const workflowsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireOperationsDb();
    const rows = await db.select().from(workflows).where(eq(workflows.ownerId, ctx.user.id)).orderBy(desc(workflows.updatedAt));
    const steps = await getWorkflowSteps(rows.map(row => row.id));
    return rows.map(row => ({ ...row, steps: steps.filter(step => step.workflowId === row.id) }));
  }),
  create: protectedProcedure
    .input(z.object({ name: z.string().trim().min(2).max(120), description: z.string().trim().min(4).max(2000), triggerType: z.enum(["scheduled", "event"]), steps: z.array(stepInput).min(1).max(20) }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireOperationsDb();
      const id = nanoid();
      await db.insert(workflows).values({ id, ownerId: ctx.user.id, name: input.name, description: input.description, triggerType: input.triggerType });
      await db.insert(workflowSteps).values(input.steps.map((step, position) => ({ workflowId: id, position, ...step })));
      return { id };
    }),
  update: protectedProcedure
    .input(z.object({ id: z.string().min(1), name: z.string().trim().min(2).max(120), description: z.string().trim().min(4).max(2000), triggerType: z.enum(["scheduled", "event"]), enabled: z.boolean(), steps: z.array(stepInput).min(1).max(20) }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireOperationsDb();
      const [workflow] = await db.select().from(workflows).where(and(eq(workflows.id, input.id), eq(workflows.ownerId, ctx.user.id))).limit(1);
      if (!workflow) throw new Error("Workflow not found");
      await db.update(workflows).set({ name: input.name, description: input.description, triggerType: input.triggerType, enabled: input.enabled, updatedAt: new Date() }).where(and(eq(workflows.id, input.id), eq(workflows.ownerId, ctx.user.id)));
      await db.delete(workflowSteps).where(eq(workflowSteps.workflowId, input.id));
      await db.insert(workflowSteps).values(input.steps.map((step, position) => ({ workflowId: input.id, position, ...step })));
      return { success: true };
    }),
  setEnabled: protectedProcedure
    .input(z.object({ id: z.string().min(1), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireOperationsDb();
      const [workflow] = await db.select().from(workflows).where(and(eq(workflows.id, input.id), eq(workflows.ownerId, ctx.user.id))).limit(1);
      if (!workflow) throw new Error("Workflow not found");
      await db.update(workflows).set({ enabled: input.enabled, updatedAt: new Date() }).where(eq(workflows.id, input.id));
      return { ...workflow, enabled: input.enabled };
    }),
  runNow: protectedProcedure
    .input(z.object({ workflowId: z.string().min(1) }))
    .mutation(({ ctx, input }) => executeWorkflowRun({ ownerId: ctx.user.id, workflowId: input.workflowId, runLabel: "Manual workflow run" })),
  runHistory: protectedProcedure
    .input(z.object({ workflowId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const db = await requireOperationsDb();
      return db.select().from(executionRuns).where(and(eq(executionRuns.ownerId, ctx.user.id), eq(executionRuns.sourceId, input.workflowId))).orderBy(desc(executionRuns.startedAt)).limit(20);
    }),
});
