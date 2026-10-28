import "server-only";
import { db } from "@/lib/supabase/server";
import type { Format } from "@/lib/formats";

// 찾기 요청 (design 5A, eng E5). 카드·규격·방문자 단위로 한 번만 센다.
// 카드 상세 HTML은 방문자와 무관하게 만들고, 요청 상태는 브라우저가 따로 불러온다 (eng R8).

export type RequestState = Record<Format, { requested: boolean; waiting: number | null }>;

export async function requestState(cardId: string, visitorId: string | null): Promise<RequestState> {
  const { data, error } = await db().rpc("card_request_state", {
    p_card: cardId,
    // 방문자 ID가 없으면 아무 요청과도 맞지 않는 값으로 조회한다.
    p_visitor: visitorId ?? "00000000-0000-0000-0000-000000000000",
  });
  if (error) throw error;
  return Object.fromEntries(
    (data as { format: Format; requested: boolean; waiting: number | null }[]).map((r) => [
      r.format,
      { requested: r.requested, waiting: r.waiting },
    ]),
  ) as RequestState;
}

export async function createRequest(cardId: string, format: Format, visitorId: string): Promise<void> {
  const { error } = await db().rpc("request_create", { p_card: cardId, p_format: format, p_visitor: visitorId });
  if (error) throw error;
}

// 도안이 0개인 카드를 본 방문 (eng R11). 측정용이라 실패해도 화면을 막지 않는다.
export async function recordDemandIfEmpty(cardId: string, visitorId: string | null): Promise<void> {
  if (!visitorId) return;
  const { count, error } = await db()
    .from("artworks")
    .select("id", { count: "exact", head: true })
    .eq("card_id", cardId)
    .eq("status", "active");
  if (error) throw error;
  if (count === 0) {
    const { error: insertError } = await db().from("card_demand").insert({ card_id: cardId, visitor_id: visitorId });
    if (insertError) throw insertError;
  }
}

export async function cardExists(cardId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(cardId)) return false;
  const { data, error } = await db().from("cards").select("id").eq("id", cardId).maybeSingle();
  if (error) throw error;
  return !!data;
}
