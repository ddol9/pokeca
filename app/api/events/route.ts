import { after } from "next/server";
import { db } from "@/lib/supabase/server";
import { visitorId } from "@/lib/visitor";
import { UUID } from "@/lib/uuid";

// 원본 글 클릭 측정 (설계 "측정"). 브라우저가 sendBeacon으로 보낸다. 실패해도 사용자에게는 보이지 않는다.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const artworkId = typeof body?.artworkId === "string" ? body.artworkId : "";
  if (body?.type !== "source_click" || !UUID.test(artworkId)) {
    return new Response(null, { status: 400 });
  }
  const visitor = await visitorId();
  after(async () => {
    const { data } = await db().from("artworks").select("card_id").eq("id", artworkId).maybeSingle();
    if (!data) return;
    const { error } = await db()
      .from("events")
      .insert({ type: "source_click", visitor_id: visitor, artwork_id: artworkId, card_id: data.card_id });
    if (error) console.error("source_click event", error);
  });
  return new Response(null, { status: 204 });
}
