// cards:fetch로 만든 한글판 CSV에 일본판 별칭(alias_set_code_ja·alias_number_ja·name_ja)을 채운다.
//
//   npm run cards:aliases-ja -- --in data/cards-kr.csv --out data/cards-kr.csv
//
// SV·메가 시리즈는 한글판과 일본판이 같은 세트 코드·번호를 쓴다(예: SV2a 201/165). TCGdex 일본어 데이터에서
// 같은 코드·번호의 카드를 찾고, 일러스트레이터까지 같을 때만 별칭으로 붙인다. 한글판은 트레이너스 카드를
// 가나다순으로 다시 매겨 번호가 어긋나기도 한다(한글 SV2a 196 = 일본 198). 그때는 같은 세트의 기본 번호를 넘는
// 카드 가운데 일러스트레이터가 같은 카드가 하나뿐일 때만 그 번호로 붙인다. 그래도 못 찾으면 목록으로 보여 준다.
// --cache 폴더에 받은 응답을 남겨 두면 다시 돌릴 때 요청하지 않는다.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseCsv } from "../lib/card-import.ts";

const API = "https://api.tcgdex.net/v2/ja";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const input = opt("in");
const out = opt("out") ?? input;
const cacheDir = opt("cache");
if (!input) {
  console.error("사용법: npm run cards:aliases-ja -- --in cards-kr.csv [--out merged.csv] [--cache dir]");
  process.exit(2);
}
if (cacheDir) await mkdir(cacheDir, { recursive: true });

type JaCard = { localId: string; name: string; illustrator?: string };

// 없는 카드는 404. 그 외 실패는 멈춘다.
async function jaCard(setId: string, localId: string): Promise<JaCard | null> {
  const key = `${setId}-${localId}`;
  const cached = cacheDir && path.join(cacheDir, `${key}.json`);
  if (cached) {
    const hit = await readFile(cached, "utf8").catch(() => null);
    if (hit !== null) return hit === "null" ? null : JSON.parse(hit);
  }
  const res = await fetch(`${API}/cards/${encodeURIComponent(key)}`);
  if (!res.ok && res.status !== 404) throw new Error(`${key}: HTTP ${res.status}`);
  const card = res.ok ? ((await res.json()) as JaCard) : null;
  if (cached) await writeFile(cached, JSON.stringify(card));
  return card;
}

// TCGdex 세트 id는 대소문자가 섞여 있다(SV2a, SV4M). 한글판 CSV의 코드를 그 표기로 맞춘다.
const jaSets = new Map(
  ((await (await fetch(`${API}/sets`)).json()) as { id: string }[]).map((s) => [s.id.toLowerCase(), s.id]),
);

const rows = parseCsv(await readFile(input, "utf8"));
const header = rows[0].cells;
const col = (name: string) => {
  let i = header.indexOf(name);
  if (i < 0) {
    header.push(name);
    i = header.length - 1;
  }
  return i;
};
const c = {
  set: col("set_code"),
  number: col("collector_number"),
  illustrator: col("illustrator"),
  aliasSet: col("alias_set_code_ja"),
  aliasNumber: col("alias_number_ja"),
  name: col("name_ja"),
};
// 대소문자·공백·악센트 차이는 같은 이름으로 본다("Mékayu" = "Mekayu").
const norm = (s: string | undefined) =>
  (s ?? "").normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase().replace(/\s+/g, " ");

// 세트의 기본 번호를 넘는 일본판 카드들(번호 → 카드). 번호가 어긋난 카드를 일러스트레이터로 찾을 때만 받는다.
const secretCards = new Map<string, Promise<JaCard[]>>();
function jaSecrets(setId: string, total: number): Promise<JaCard[]> {
  const key = `${setId}/${total}`;
  if (!secretCards.has(key))
    secretCards.set(
      key,
      (async () => {
        const set = (await (await fetch(`${API}/sets/${encodeURIComponent(setId)}`)).json()) as { cards: { localId: string }[] };
        const ids = set.cards.map((card) => card.localId).filter((id) => Number(id) > total);
        const cards: JaCard[] = [];
        for (const id of ids) {
          const card = await jaCard(setId, id);
          if (card) cards.push(card);
        }
        return cards;
      })(),
    );
  return secretCards.get(key)!;
}
// 이미 다른 행에 붙은 일본판 번호(세트별). 같은 카드를 두 번 붙이지 않는다.
const used = new Set(rows.slice(1).filter((r) => r.cells[c.aliasSet]).map((r) => `${r.cells[c.aliasSet]} ${r.cells[c.aliasNumber]}`));

let added = 0;
const skipped: string[] = [];
const moved: string[] = [];
const attach = (cells: string[], setId: string, aliasNumber: string, jaName: string) => {
  used.add(`${setId} ${aliasNumber}`);
  cells[c.aliasSet] = setId;
  cells[c.aliasNumber] = aliasNumber;
  cells[c.name] = jaName;
  added++;
};

// 1차: 번호와 일러스트레이터가 모두 같은 카드를 먼저 붙인다. 번호가 어긋난 카드는 2차에서 남은 일본판 카드로 맞춘다.
const renumbered: { label: string; cells: string[]; setId: string; ja: JaCard }[] = [];
for (const { line, cells } of rows.slice(1)) {
  const setCode = cells[c.set];
  const number = cells[c.number];
  const label = `${line}행 ${setCode} ${number}`;
  if (cells[c.aliasSet]) continue;
  const setId = jaSets.get(setCode.toLowerCase());
  const localId = number.match(/^(\d+)\//)?.[1];
  if (!setId || !localId) {
    skipped.push(`${label}: 일본판 세트 없음`);
    continue;
  }
  const ja = await jaCard(setId, localId);
  if (!ja) {
    skipped.push(`${label}: 일본판 카드 없음`);
    continue;
  }
  if (norm(ja.illustrator) === norm(cells[c.illustrator])) attach(cells, setId, number, ja.name);
  else renumbered.push({ label, cells, setId, ja });
}

for (const { label, cells, setId, ja } of renumbered) {
  const [kr, base] = cells[c.number].split("/");
  const illustrator = cells[c.illustrator];
  // 한글판 번호와 같은 자릿수로 맞춘다(일본 "99" → "099/073"). 이미 다른 행에 붙은 일본판 카드는 후보에서 뺀다.
  const pad = (localId: string) => `${localId.padStart(kr.length, "0")}/${base}`;
  const same = illustrator
    ? (await jaSecrets(setId, Number(base))).filter(
        (card) => norm(card.illustrator) === norm(illustrator) && !used.has(`${setId} ${pad(card.localId)}`),
      )
    : [];
  if (same.length !== 1) {
    skipped.push(`${label}: 일러스트레이터 다름 (한글 ${illustrator || "-"} / 일본 ${ja.illustrator ?? "-"})`);
    continue;
  }
  moved.push(`${label} → 일본 ${pad(same[0].localId)} ${same[0].name}`);
  attach(cells, setId, pad(same[0].localId), same[0].name);
}

const cell = (v = "") => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
await writeFile(out!, rows.map((r) => header.map((_, i) => cell(r.cells[i])).join(",")).join("\n") + "\n");
console.log(`일본판 별칭 ${added}장 추가 → ${out}`);
if (moved.length) console.log(`번호가 달라 일러스트레이터로 맞춤 ${moved.length}장:\n  ${moved.join("\n  ")}`);
if (skipped.length) console.log(`붙이지 않음 ${skipped.length}장:\n  ${skipped.join("\n  ")}`);
