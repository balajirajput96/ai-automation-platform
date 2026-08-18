import { scheduledJobs, workflows } from "../../drizzle/schema";
import { and, desc, eq } from "drizzle-orm";
import { parse as parseCookie } from "cookie";
import { nanoid } from "nanoid";
import { z } from "zod";
import { createHeartbeatJob, updateHeartbeatJob } from "../_core/heartbeat";
import { protectedProcedure, router } from "../_core/trpc";
import { requireOperationsDb } from "../db";
import { COOKIE_NAME } from "../../shared/const";

const cronInput = z.string().trim().regex(/^\S+(\s+\S+){5}$/, "Use a six-field UTC cron expression.");

export const schedulesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireOperationsDb();
    return db.select().from(scheduledJobs).where(eq(scheduledJobs.ownerId, ctx.user.id)).orderBy(desc(scheduledJobs.createdAt));
  }),
  create: protectedProcedure
    .input(z.object({ name: z.string().trim().min(2).max(120), workflowId: z.string().min(1), cronExpression: cronInput }))
    .mutation(async ({ ctx, input }) => {
      if (process.env.NODE_ENV !== "production") {
        throw new Error("Publish the platform before creating recurring jobs so callbacks have a stable production endpoint.");
      }
      const db = await requireOperationsDb();
      const [workflow] = await db.select().from(workflows).where(and(eq(workflows.id, input.workflowId), eq(workflows.ownerId, ctx.user.id))).limit(1);
      if (!workflow) throw new Error("Workflow not found");
      const id = nanoid();
      const callbackToken = nanoid();
      await db.insert(scheduledJobs).values({ id, ownerId: ctx.user.id, callbackToken, ...input });
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      try {
        const job = await createHeartbeatJob({ name: `astra-${ctx.user.id}-${id}`, cron: input.cronExpression, path: "/api/scheduled/workflow", payload: { jobId: id, callbackToken }, description: `AstraFlow recurring job: ${input.name}` }, sessionToken);
        await db.update(scheduledJobs).set({ scheduleCronTaskUid: job.taskUid, nextRunAt: job.nextExecutionAt ? new Date(job.nextExecutionAt) : null }).where(eq(scheduledJobs.id, id));
        return { id, nextRunAt: job.nextExecutionAt ?? null };
      } catch (error) {
        await db.delete(scheduledJobs).where(eq(scheduledJobs.id, id));
        throw error;
      }
    }),
  setEnabled: protectedProcedure
    .input(z.object({ id: z.string().min(1), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireOperationsDb();
      const [job] = await db.select().from(scheduledJobs).where(and(eq(scheduledJobs.id, input.id), eq(scheduledJobs.ownerId, ctx.user.id))).limit(1);
      if (!job || !job.scheduleCronTaskUid) throw new Error("Scheduled job is not ready to update");
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      const heartbeat = await updateHeartbeatJob(job.scheduleCronTaskUid, { enable: input.enabled }, sessionToken);
      await db.update(scheduledJobs).set({ enabled: input.enabled, nextRunAt: heartbeat.nextExecutionAt ? new Date(heartbeat.nextExecutionAt) : null, updatedAt: new Date() }).where(eq(scheduledJobs.id, input.id));
      return { success: true, nextRunAt: heartbeat.nextExecutionAt ?? null };
    }),
});
