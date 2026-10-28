// 지원 규격. 서버와 브라우저가 함께 쓴다(server-only 아님).
export const FORMATS = ["9pocket", "psa", "brg"] as const;
export type Format = (typeof FORMATS)[number];

// 인쇄 안내 치수 (eng E8). 확인된 규격만 적는다. 없으면 치수를 표시하지 않는다.
export const FORMAT_INFO: Record<Format, { label: string; printSize: string | null }> = {
  "9pocket": { label: "9포켓", printSize: "9포켓 조각 63×88 mm" },
  psa: { label: "PSA", printSize: null },
  brg: { label: "BRG", printSize: null },
};

export function isFormat(value: unknown): value is Format {
  return typeof value === "string" && (FORMATS as readonly string[]).includes(value);
}
