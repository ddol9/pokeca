import { resolveThumbnail } from "@/lib/artworks";

// 썸네일은 매번 상태와 허락을 확인한 뒤 짧은 서명 URL로 보낸다. 공개 영구 URL은 없다.
export async function GET(_request: Request, ctx: RouteContext<"/api/thumbnails/[id]">) {
  const { id } = await ctx.params;
  const url = await resolveThumbnail(id);
  if (!url) return new Response(null, { status: 404 });
  return new Response(null, {
    status: 302,
    // 브라우저가 서명 URL보다 오래 들고 있지 않게 한다.
    headers: { Location: url, "Cache-Control": "private, max-age=240" },
  });
}
