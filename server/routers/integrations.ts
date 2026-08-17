import { ensureIntegrationCatalog } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export const integrationsRouter = router({
  list: protectedProcedure.query(({ ctx }) => ensureIntegrationCatalog(ctx.user.id)),
});
