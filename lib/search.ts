// 검색어 해석 (eng D7, D14).
//
//   query ─> parseQuery ─┬─ set+number ─> 정본/별칭 정확 매칭 ─┬─ 1건 → 카드 상세 직행
//                        │                                    └─ 0건 → search_misses
//                        ├─ number only ─> 번호가 같은 카드 목록 (0건 → search_misses)
//                        └─ 그 외 ─> 이름 pg_trgm 검색 (0건 → search_misses)
//
// 사람들은 같은 카드를 "SV2A 201/165", "sv2a-201", "201／165"처럼 제각각 입력한다.
// 여기서 형태를 맞춰 두면 DB 쪽은 정확 매칭만 하면 된다.

export type ParsedQuery =
  | { kind: "set_number"; set: string; number: string; total: string | null }
  | { kind: "number"; number: string; total: string | null }
  | { kind: "name"; text: string }
  | { kind: "empty" };

// 번호: "201", "TG01", "SWSH050"처럼 숫자로 끝나는 토큰. 뒤에 "/165" 같은 총수가 붙을 수 있다.
const NUMBER = /^([a-z]{0,4}\d+)(?:\/([a-z]{0,4}\d+))?$/;
// 세트 코드: 영문자로 시작. "sv2a", "s12a", "sv-p".
const SET = /^[a-z][a-z0-9-]*$/;

export function parseQuery(raw: string): ParsedQuery {
  // NFKC는 전각 문자(／, ＳＶ２ａ)를 반각으로 바꾼다.
  const text = raw.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!text) return { kind: "empty" };

  const lower = text.toLowerCase().replace(/\s*\/\s*/g, "/");

  const numberOnly = lower.replace(/^(no\.?|#)\s*/, "").match(NUMBER);
  if (numberOnly) {
    return { kind: "number", number: normalizeNumber(numberOnly[1]), total: normalizeTotal(numberOnly[2]) };
  }

  // 세트와 번호 사이에는 공백, '#', '_' 또는 마지막 '-'가 있어야 한다.
  const split = lower.match(/^(.+?)(?:\s*[#_]\s*|\s+|-)([a-z]{0,4}\d+(?:\/[a-z]{0,4}\d+)?)$/);
  if (split && SET.test(split[1])) {
    const num = split[2].match(NUMBER)!;
    return {
      kind: "set_number",
      set: split[1],
      number: normalizeNumber(num[1]),
      total: normalizeTotal(num[2]),
    };
  }

  return { kind: "name", text };
}

// "001" → "1", "tg01" → "TG1". DB의 normalize_collector_number와 같은 규칙이어야 한다.
export function normalizeNumber(token: string): string {
  const m = token.match(/^([a-z]*)0*(\d+)$/i)!;
  return `${m[1].toUpperCase()}${m[2]}`;
}

function normalizeTotal(token: string | undefined): string | null {
  return token ? normalizeNumber(token) : null;
}

// 카드 상세 URL에서 번호의 '/'를 '-'로 바꾼다: /cards/sv2a/201-165
export function cardPath(setCode: string, collectorNumber: string): string {
  return `/cards/${encodeURIComponent(setCode)}/${encodeURIComponent(collectorNumber.replace("/", "-"))}`;
}

export function numberFromPath(segment: string): string {
  return decodeURIComponent(segment).replace("-", "/");
}
