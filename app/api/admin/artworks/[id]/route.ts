import { applyAdminAction } from "@/lib/admin";
import { adminRoute } from "@/lib/admin-route";

// 숨김·복구·철회·허락 변경. 철회와 허락 하향은 body.confirm(정본 카드 번호)이 맞아야 한다 (eng E1).
export const PATCH = adminRoute<RouteContext<"/api/admin/artworks/[id]">>(async (request, ctx, admin) => {
  const { id } = await ctx.params;
  const result = await applyAdminAction(id, await request.json(), admin);
  return Response.json(result);
});
