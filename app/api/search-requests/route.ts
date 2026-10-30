import { db } from "@/lib/supabase/server";
import { parseQuery } from "@/lib/search";
import { visitorId } from "@/lib/visitor";

// 못 찾은 카드의 찾기 요청 (design 6A). 같은 방문자가 같은 검색어로 다시 눌러도 한 번만 남긴다.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const query = typeof body?.query === "string" ? body.query.trim().slice(0, 100) : "";
  const parsed = parseQuery(query);
  if (parsed.kind === "empty") return new Response(null, { status: 400 });

  const visitor = await visitorId();
  if (visitor) {
    const { data, error } = await db()
      .from("search_misses")
      .select("id")
      .eq("visitor_id", visitor)
      .eq("query", query)
      .eq("requested", true)
      .limit(1);
    if (error) return new Response(null, { status: 500 });
    if (data.length > 0) return new Response(null, { status: 204 });
  }
  const { error } = await db()
    .from("search_misses")
    .insert({ query, parsed, visitor_id: visitor, requested: true });
  return new Response(null, { status: error ? 500 : 204 });
}
