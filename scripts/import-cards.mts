// 카드 시드 CSV를 DB에 넣는다.
//
//   npm run cards:import -- cards.csv            # 검사만 하고 몇 장이 추가·갱신될지 보여 준다
//   npm run cards:import -- cards.csv --apply    # 실제로 넣는다
//
// 운영 DB에 넣을 때는 NEXT_PUBLIC_SUPABASE_URL·SUPABASE_SECRET_KEY를 운영 값으로 주고 돌린다.
// 문제가 하나라도 있으면 아무것도 쓰지 않는다(DB 함수 cards_import가 한 트랜잭션으로 처리).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parseCardImport, type ImportError } from "../lib/card-import.ts";

function fail(errors: ImportError[]): never {
  for (const e of errors) console.error(e.line ? `${e.line}행: ${e.message}` : e.message);
  console.error(`\n오류 ${errors.length}건. 아무것도 넣지 않았어요.`);
  process.exit(1);
}

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const apply = args.includes("--apply");
if (!file) {
  console.error("사용법: npm run cards:import -- <cards.csv> [--apply]");
  process.exit(2);
}

const parsed = parseCardImport(readFileSync(file, "utf8"));
if (parsed.errors.length) fail(parsed.errors);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SECRET_KEY가 필요해요(.env.local 또는 환경 변수).");
  process.exit(2);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await db.rpc("cards_import", {
  p_sets: parsed.sets,
  p_cards: parsed.cards,
  p_dry_run: !apply,
});
if (error) throw error;
if (!data.ok) fail(data.errors);

console.log(`대상: ${url}`);
console.log(`카드 ${parsed.cards.length}장: 새로 ${data.inserted}장, 갱신 ${data.updated}장 · 별칭 ${data.aliases}개`);
console.log(apply ? "넣었어요." : "검사만 했어요. 넣으려면 --apply를 붙여 다시 실행하세요.");
