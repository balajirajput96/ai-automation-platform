import { projects } from "../../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { listProjectsWithLinks, replaceProjectLinks, requireOperationsDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const projectInput = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(4).max(2000),
  status: z.enum(["planning", "active", "paused", "complete"]),
  agentIds: z.array(z.string().min(1)).max(30).default([]),
  workflowIds: z.array(z.string().min(1)).max(30).default([]),
});

export const projectsRouter = router({
  list: protectedProcedure.query(({ ctx }) => listProjectsWithLinks(ctx.user.id)),
  create: protectedProcedure.input(projectInput).mutation(async ({ ctx, input }) => {
    const db = await requireOperationsDb();
    const id = nanoid();
    await db.transaction(async transaction => {
      await transaction.insert(projects).values({ id, ownerId: ctx.user.id, title: input.title, description: input.description, status: input.status });
      await replaceProjectLinks(ctx.user.id, id, input.agentIds, input.workflowIds, transaction);
    });
    return { id };
  }),
  update: protectedProcedure.input(projectInput.extend({ id: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    const db = await requireOperationsDb();
    const [project] = await db.select().from(projects).where(and(eq(projects.id, input.id), eq(projects.ownerId, ctx.user.id))).limit(1);
    if (!project) throw new Error("Project not found");
    await db.update(projects).set({ title: input.title, description: input.description, status: input.status, updatedAt: new Date() }).where(and(eq(projects.id, input.id), eq(projects.ownerId, ctx.user.id)));
    await replaceProjectLinks(ctx.user.id, input.id, input.agentIds, input.workflowIds);
    return { success: true };
  }),
  updateLinks: protectedProcedure.input(z.object({ id: z.string().min(1), agentIds: z.array(z.string().min(1)).max(30), workflowIds: z.array(z.string().min(1)).max(30) })).mutation(async ({ ctx, input }) => {
    const db = await requireOperationsDb();
    const [project] = await db.select().from(projects).where(and(eq(projects.id, input.id), eq(projects.ownerId, ctx.user.id))).limit(1);
    if (!project) throw new Error("Project not found");
    await replaceProjectLinks(ctx.user.id, input.id, input.agentIds, input.workflowIds);
    return { success: true };
  }),
});
