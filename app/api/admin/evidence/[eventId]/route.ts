import { adminRoute } from "@/lib/admin-route";
import { evidenceUrl } from "@/lib/admin-data";

// 허락 근거 보기 (설계 R3). 어드민만, 1분짜리 서명 URL로 보낸다. 공개 라우트에는 이 버킷을 읽는 길이 없다.
export const GET = adminRoute<RouteContext<"/api/admin/evidence/[eventId]">>(async (_request, ctx) => {
  const { eventId } = await ctx.params;
  const url = await evidenceUrl(eventId);
  if (!url) return Response.json({ code: "not_found" }, { status: 404 });
  return new Response(null, {
    status: 302,
    headers: { Location: url, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
});
