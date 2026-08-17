import { aiAgents, executionRuns } from "../../drizzle/schema";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { requireOperationsDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const agentStatus = z.enum(["active", "paused"]);

export const agentsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireOperationsDb();
    return db.select().from(aiAgents).where(eq(aiAgents.ownerId, ctx.user.id)).orderBy(desc(aiAgents.updatedAt));
  }),
  create: protectedProcedure
    .input(z.object({ name: z.string().trim().min(2).max(120), description: z.string().trim().min(4).max(2000), configuration: z.string().trim().max(5000).default("{}") }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireOperationsDb();
      const id = nanoid();
      await db.insert(aiAgents).values({ id, ownerId: ctx.user.id, ...input, status: "active" });
      return { id };
    }),
  update: protectedProcedure
    .input(z.object({ id: z.string().min(1), name: z.string().trim().min(2).max(120), description: z.string().trim().min(4).max(2000), configuration: z.string().trim().max(5000), status: agentStatus }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireOperationsDb();
      const [agent] = await db.select().from(aiAgents).where(and(eq(aiAgents.id, input.id), eq(aiAgents.ownerId, ctx.user.id))).limit(1);
      if (!agent) throw new Error("Agent not found");
      await db.update(aiAgents).set({ name: input.name, description: input.description, configuration: input.configuration, status: input.status, updatedAt: new Date() }).where(and(eq(aiAgents.id, input.id), eq(aiAgents.ownerId, ctx.user.id)));
      return { ...agent, ...input };
    }),
  setStatus: protectedProcedure
    .input(z.object({ id: z.string().min(1), status: agentStatus }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireOperationsDb();
      const [agent] = await db.select().from(aiAgents).where(and(eq(aiAgents.id, input.id), eq(aiAgents.ownerId, ctx.user.id))).limit(1);
      if (!agent) throw new Error("Agent not found");
      await db.update(aiAgents).set({ status: input.status, updatedAt: new Date() }).where(and(eq(aiAgents.id, input.id), eq(aiAgents.ownerId, ctx.user.id)));
      return { ...agent, status: input.status };
    }),
  runHistory: protectedProcedure
    .input(z.object({ agentId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const db = await requireOperationsDb();
      return db.select().from(executionRuns).where(and(eq(executionRuns.ownerId, ctx.user.id), eq(executionRuns.sourceId, input.agentId))).orderBy(desc(executionRuns.startedAt)).limit(20);
    }),
});
