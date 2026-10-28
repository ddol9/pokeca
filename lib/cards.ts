import "server-only";
import { db } from "@/lib/supabase/server";
import { parseQuery, type ParsedQuery } from "@/lib/search";

// 공개 응답 DTO (eng D6). DB 행을 그대로 내보내지 않는다.
export type CardHit = {
  cardId: string;
  setCode: string;
  collectorNumber: string;
  nameKo: string;
  rarity: string | null;
  setName: string;
  artworkCount: number;
  alias: { lang: "ja" | "en"; setCode: string; collectorNumber: string } | null;
};

type CardHitRow = {
  card_id: string;
  set_code: string;
  collector_number: string;
  name_ko: string;
  rarity: string | null;
  set_name: string;
  artwork_count: number;
  alias_lang: "ja" | "en" | null;
  alias_set_code: string | null;
  alias_number: string | null;
};

function toHit(r: CardHitRow): CardHit {
  return {
    cardId: r.card_id,
    setCode: r.set_code,
    collectorNumber: r.collector_number,
    nameKo: r.name_ko,
    rarity: r.rarity,
    setName: r.set_name,
    artworkCount: r.artwork_count,
    alias: r.alias_lang
      ? { lang: r.alias_lang, setCode: r.alias_set_code!, collectorNumber: r.alias_number! }
      : null,
  };
}

export type SearchResult = { parsed: ParsedQuery; hits: CardHit[] };

export async function searchCards(query: string): Promise<SearchResult> {
  const parsed = parseQuery(query);
  if (parsed.kind === "empty") return { parsed, hits: [] };

  const { data, error } =
    parsed.kind === "name"
      ? await db().rpc("search_cards_by_name", { p_text: parsed.text })
      : await db().rpc("search_cards_by_number", {
          p_set: parsed.kind === "set_number" ? parsed.set : null,
          p_number: parsed.number,
          p_total: parsed.total,
        });
  if (error) throw error;
  return { parsed, hits: (data as CardHitRow[]).map(toHit) };
}

// 측정 기록은 실패해도 화면을 막지 않는다. 호출자는 after() 안에서 부른다.
export async function recordSearch(
  query: string,
  result: SearchResult,
  visitorId: string | null,
): Promise<void> {
  const client = db();
  await client.from("events").insert({
    type: "search",
    visitor_id: visitorId,
    card_id: result.hits.length === 1 ? result.hits[0].cardId : null,
    payload: { query, kind: result.parsed.kind, hits: result.hits.length },
  });
  if (result.hits.length === 0 && result.parsed.kind !== "empty") {
    await client
      .from("search_misses")
      .insert({ query, parsed: result.parsed, visitor_id: visitorId });
  }
}

export type CardDetail = {
  cardId: string;
  setCode: string;
  collectorNumber: string;
  nameKo: string;
  rarity: string | null;
  illustrator: string | null;
  setName: string;
};

export async function getCard(setCode: string, collectorNumber: string): Promise<CardDetail | null> {
  const { data, error } = await db()
    .from("cards")
    .select("id, set_code, collector_number, name_ko, rarity, illustrator, sets(name_ko)")
    .eq("set_code", setCode)
    .eq("collector_number", collectorNumber)
    .maybeSingle<{
      id: string;
      set_code: string;
      collector_number: string;
      name_ko: string;
      rarity: string | null;
      illustrator: string | null;
      sets: { name_ko: string };
    }>();
  if (error) throw error;
  if (!data) return null;
  return {
    cardId: data.id,
    setCode: data.set_code,
    collectorNumber: data.collector_number,
    nameKo: data.name_ko,
    rarity: data.rarity,
    illustrator: data.illustrator,
    setName: data.sets.name_ko,
  };
}
