// 지원 규격. 서버와 브라우저가 함께 쓴다(server-only 아님).
export const FORMATS = ["9pocket", "psa", "brg"] as const;
export type Format = (typeof FORMATS)[number];

// 인쇄 안내 치수 (eng E8). 확인된 규격만 적는다. 없으면 치수를 표시하지 않는다.
// PSA: 슬랩(80.25×135.75 mm) 위에 덧씌우는 보관 케이스(바깥 86×142 mm) 안에 슬랩 앞쪽으로 넣는 한 장.
//      라벨(68×20 mm)과 카드(63×88 mm) 자리를 뺀 여백을 그림이 채운다. 인쇄 크기는 케이스 안쪽 크기.
// BRG: 보관 케이스 안쪽 크기를 아직 확인하지 못했다.
export const FORMAT_INFO: Record<Format, { label: string; printSize: string | null }> = {
  "9pocket": { label: "9포켓", printSize: "9포켓 조각 63×88 mm" },
  psa: { label: "PSA", printSize: "PSA 보관 케이스 안쪽 80×135 mm" },
  brg: { label: "BRG", printSize: null },
};

export function isFormat(value: unknown): value is Format {
  return typeof value === "string" && (FORMATS as readonly string[]).includes(value);
}
