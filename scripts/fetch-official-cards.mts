// 공식 한국 카드 사이트(pokemoncard.co.kr)에서 카드 목록을 모아 cards:import용 CSV로 만든다.
//
//   npm run cards:fetch -- --years 2023-2026 --out data/cards-kr.csv
//   npm run cards:fetch -- --years 2023 --products 14 --out /tmp/151.csv     # 151 한 세트만
//
// 카드 상세 주소는 /cards/detail/BS{연도}{제품 3자리}{번호 3자리}다(예: BS2023014201 = SV2a 201/165).
// 기본은 확장 아트 대상인 "기본 번호를 넘는 카드"(AR·SR·SAR 등)만 모은다. --all이면 세트 전체.
// 그림·효과 문구는 가져오지 않고 세트·번호·이름·레어도·일러스트레이터만 쓴다. 요청은 --delay(기본 700ms) 간격으로 보낸다.
// --cache 폴더에 받은 HTML을 남겨 두면 다시 돌릴 때 사이트에 요청하지 않는다.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = "https://pokemoncard.co.kr/cards/detail/";
const TCGDEX_KO_SETS = "https://api.tcgdex.net/v2/ko/sets";

type Card = { setCode: string; number: string; nameKo: string; rarity: string; illustrator: string };

const args = process.argv.slice(2);
function opt(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}
function range(value: string | undefined, fallback: [number, number]): number[] {
  const [a, b] = value ? value.split("-").map(Number) : fallback;
  return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i);
}

const years = range(opt("years"), [2023, new Date().getFullYear()]);
const products = opt("products") ? range(opt("products"), [1, 1]) : null;
const out = opt("out");
const cacheDir = opt("cache");
const delay = Number(opt("delay") ?? 700);
const all = args.includes("--all");
if (!out) {
  console.error("사용법: npm run cards:fetch -- --years 2023-2026 [--products 1-40] [--all] [--cache dir] --out cards.csv");
  process.exit(2);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function page(id: string): Promise<string> {
  const cached = cacheDir && path.join(cacheDir, `${id}.html`);
  if (cached) {
    const hit = await readFile(cached, "utf8").catch(() => null);
    if (hit !== null) return hit;
  }
  // 사이트가 가끔 상세 페이지 전체에 500을 낸다. 잠시 쉬었다가 다시 묻고, 계속 실패하면 멈춘다.
  let html = "";
  for (let attempt = 1; ; attempt++) {
    await sleep(attempt === 1 ? delay : 30_000 * attempt);
    const res = await fetch(BASE + id, { headers: { "User-Agent": "pokeca-archive card list (nonprofit fan archive)" } });
    if (res.ok) {
      html = await res.text();
      break;
    }
    if (res.status < 500 || attempt === 4) throw new Error(`${id}: HTTP ${res.status} (공식 사이트 상세 페이지 오류)`);
    console.log(`${id}: HTTP ${res.status}, ${30 * (attempt + 1)}초 뒤 다시 시도`);
  }
  if (cached) await writeFile(cached, html);
  return html;
}

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"');

// 없는 번호는 200으로 빈 상세 화면을 돌려준다. 번호 칸이 없으면 카드가 없는 것으로 본다.
export function parseDetail(html: string): Card | null {
  const head = html.match(/symbol\/([A-Za-z0-9-]+)\.png"><img[^>]*symbol\/[A-Za-z0-9]+\.png"><span class="p_num">([^<]*)/);
  if (!head) return null;
  const rarity = html.match(/id="no_wrap_by_admin">([^<]*)</)?.[1].trim() ?? "";
  const illustrator = html.match(/<p class="illustrator">일러스트<br\s*\/?>([^<]*)<\/p>/)?.[1].trim() ?? "";
  const nameKo = html.match(/<span class="card-hp title">([^<]*)<\/span>/)?.[1].trim() ?? "";
  return { setCode: head[1], number: head[2].trim(), nameKo: decode(nameKo), rarity, illustrator: decode(illustrator) };
}

const id = (year: number, product: number, n: number) =>
  `BS${year}${String(product).padStart(3, "0")}${String(n).padStart(3, "0")}`;

// 기본 번호("201/165"의 165). 프로모처럼 분모가 숫자가 아니면 null.
const officialTotal = (number: string) => {
  const m = number.match(/^\d+\/(\d+)$/);
  return m ? Number(m[1]) : null;
};

if (cacheDir) await mkdir(cacheDir, { recursive: true });

const setNames = new Map<string, string>(
  ((await (await fetch(TCGDEX_KO_SETS)).json()) as { id: string; name: string }[]).map((s) => [s.id.toLowerCase(), s.name]),
);

const cards: Card[] = [];
const broken: string[] = [];
for (const year of years) {
  let misses = 0;
  for (let p = products?.[0] ?? 1; products ? p <= products[products.length - 1] : misses < 5; p++) {
    // 특정 제품만 계속 500을 내기도 한다(2023-001 S12a). 그 제품은 건너뛰고 끝에 알린다.
    const html = await page(id(year, p, 1)).catch((e: Error) => (broken.push(e.message), null));
    if (html === null) continue;
    const first = parseDetail(html);
    if (!first) {
      misses++;
      continue;
    }
    misses = 0;
    const total = officialTotal(first.number);
    if (total === null) {
      console.log(`${id(year, p, 0)} ${first.setCode} ${first.number}: 번호 체계가 달라 건너뜀`);
      continue;
    }
    const start = all ? 1 : total + 1;
    let found = 0;
    for (let n = start; n < 1000; n++) {
      const card = n === 1 ? first : parseDetail(await page(id(year, p, n)));
      if (!card) break;
      cards.push(card);
      found++;
    }
    console.log(`${id(year, p, 0)} ${first.setCode} (${setNames.get(first.setCode.toLowerCase()) ?? "이름 없음"}) 기본 ${total}장 · 가져옴 ${found}장`);
  }
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const rows = [
  ["set_code", "collector_number", "name_ko", "rarity", "illustrator", "set_name_ko"],
  ...cards.map((c) => [c.setCode, c.number, c.nameKo, c.rarity, c.illustrator, setNames.get(c.setCode.toLowerCase()) ?? c.setCode]),
];
await writeFile(out, rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n");
const missing = [...new Set(cards.map((c) => c.setCode).filter((s) => !setNames.has(s.toLowerCase())))];
console.log(`\n카드 ${cards.length}장 → ${out}`);
if (broken.length) console.log(`열리지 않아 건너뛴 제품: ${broken.join(", ")}`);
if (missing.length) console.log(`세트 이름을 못 찾아 세트 코드로 채움: ${missing.join(", ")} (CSV에서 고쳐 주세요)`);
