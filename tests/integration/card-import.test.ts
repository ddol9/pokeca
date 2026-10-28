import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { parseCardImport } from "@/lib/card-import";
import { db } from "@/lib/supabase/server";
import { sql } from "../helpers/fixtures";

// 테스트 전용 세트 zz*만 만들고 지운다. 시드 카드(sv2a)는 별칭 충돌 확인에만 읽는다.
async function clearTestSets() {
  await sql`delete from cards where set_code like 'zz%'`;
  await sql`delete from sets where code like 'zz%'`;
}
beforeEach(clearTestSets);
afterAll(async () => {
  await clearTestSets();
  await sql.end();
});

async function run(csv: string, dryRun = false) {
  const parsed = parseCardImport(csv);
  expect(parsed.errors).toEqual([]);
  const { data, error } = await db().rpc("cards_import", {
    p_sets: parsed.sets,
    p_cards: parsed.cards,
    p_dry_run: dryRun,
  });
  if (error) throw error;
  return data as { ok: boolean; inserted?: number; updated?: number; aliases?: number; errors?: { line: number; message: string }[] };
}

const CSV = [
  "set_code,collector_number,name_ko,rarity,alias_set_code_en,alias_number_en,name_en,set_name_ko",
  "zz1,1/2,가,SAR,ZZE,10/20,Ga,테스트 세트",
  "zz1,2/2,나,AR,,,,테스트 세트",
].join("\n");

describe("cards_import", () => {
  it("dry run counts without writing, apply writes, and re-running is idempotent", async () => {
    expect(await run(CSV, true)).toMatchObject({ ok: true, inserted: 2, updated: 0, aliases: 1 });
    expect(await sql`select 1 from cards where set_code = 'zz1'`).toHaveLength(0);

    expect(await run(CSV)).toMatchObject({ ok: true, inserted: 2, updated: 0 });
    expect(await run(CSV)).toMatchObject({ ok: true, inserted: 0, updated: 2 });
    const cards = await sql`select collector_number, name_ko, rarity from cards where set_code = 'zz1' order by 1`;
    expect(cards).toEqual([
      { collector_number: "1/2", name_ko: "가", rarity: "SAR" },
      { collector_number: "2/2", name_ko: "나", rarity: "AR" },
    ]);
    const [set] = await sql`select name_ko from sets where code = 'zz1'`;
    expect(set.name_ko).toBe("테스트 세트");
  });

  it("replaces a card's aliases with the file's, and lets an alias move between imported cards", async () => {
    await run(CSV);
    await run(
      [
        "set_code,collector_number,name_ko,alias_set_code_en,alias_number_en,name_en",
        "zz1,1/2,가,,,",
        "zz1,2/2,나,ZZE,10/20,Ga moved",
      ].join("\n"),
    );
    const aliases = await sql`
      select c.collector_number, a.name from card_aliases a join cards c on c.id = a.card_id
      where c.set_code = 'zz1'`;
    expect(aliases).toEqual([{ collector_number: "2/2", name: "Ga moved" }]);
  });

  it("writes nothing when a set is unknown or an alias belongs to a card outside the file", async () => {
    const result = await run(
      [
        "set_code,collector_number,name_ko,alias_set_code_en,alias_number_en,set_name_ko",
        "zz1,1/2,가,,,테스트 세트",
        "zz2,1/2,세트 없음,,,",
        "zz1,2/2,도용,mew,199/165,테스트 세트",
      ].join("\n"),
    );
    expect(result.ok).toBe(false);
    expect(result.errors!.map((e) => e.line)).toEqual([3, 4]);
    expect(result.errors![1].message).toContain("sv2a 201/165");
    expect(await sql`select 1 from cards where set_code like 'zz%'`).toHaveLength(0);
    expect(await sql`select 1 from sets where code like 'zz%'`).toHaveLength(0);
  });

  it("imported cards are found by search through their alias", async () => {
    await run(CSV);
    const { data, error } = await db().rpc("search_cards_by_number", { p_set: "zze", p_number: "10", p_total: null });
    if (error) throw error;
    expect(data).toEqual([expect.objectContaining({ collector_number: "1/2" })]);
  });
});
