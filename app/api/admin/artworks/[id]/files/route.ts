import { adminRoute } from "@/lib/admin-route";
import { attachFile } from "@/lib/artworks";

// 기존 작품에 원본·썸네일을 붙이거나 바꾼다(허락 상향 전에 먼저 파일을 붙인다).
export const POST = adminRoute<RouteContext<"/api/admin/artworks/[id]/files">>(async (request, ctx) => {
  const { id } = await ctx.params;
  const body = await request.json();
  await attachFile(id, body.kind, String(body.uploadId));
  return new Response(null, { status: 204 });
});
