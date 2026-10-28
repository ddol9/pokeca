import { after } from "next/server";
import { resolveDownload } from "@/lib/artworks";
import { db } from "@/lib/supabase/server";
import { visitorId } from "@/lib/visitor";

// 다운로드 버튼이 누른 시점에 호출한다. 서명 URL은 5분 뒤 만료되므로 화면에 남기지 않는다 (design 6A).
// 없는 작품 404, 숨김·철회·허락 밖 410 {"code":"unavailable"} (eng E2). 410에는 작품 정보를 담지 않는다.
export async function POST(_request: Request, ctx: RouteContext<"/api/download/[id]">) {
  const { id } = await ctx.params;
  const result = await resolveDownload(id);

  if (result.kind === "not_found") return Response.json({ code: "not_found" }, { status: 404 });
  if (result.kind === "unavailable") return Response.json({ code: "unavailable" }, { status: 410 });

  const visitor = await visitorId();
  after(async () => {
    const { error } = await db().from("events").insert({ type: "download", visitor_id: visitor, artwork_id: id });
    if (error) console.error("download event", error);
  });
  return Response.json({ url: result.url }, { headers: { "Cache-Control": "no-store" } });
}
