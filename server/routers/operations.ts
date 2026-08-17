import { z } from "zod";
import { getOperationsOverview, getPagedRuns } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export const operationsRouter = router({
  overview: protectedProcedure.query(({ ctx }) => getOperationsOverview(ctx.user.id)),
  runs: protectedProcedure
    .input(z.object({ page: z.number().int().min(1).default(1), pageSize: z.number().int().min(5).max(50).default(10) }))
    .query(({ ctx, input }) => getPagedRuns(ctx.user.id, input.page, input.pageSize)),
});
