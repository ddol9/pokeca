import { describe, expect, it } from "vitest";
import { searchCards } from "@/lib/cards";

// seed.sql: sv2a 201/165 리자몽 ex (영문 별칭 MEW 199/165), sv2a 205/165 뮤 ex
describe("searchCards", () => {
  it("finds a card by canonical set and number in any common spelling", async () => {
    for (const q of ["sv2a 201/165", "SV2A-201", "ｓｖ２ａ　２０１"]) {
      const { hits } = await searchCards(q);
      expect(hits.map((h) => h.collectorNumber), q).toEqual(["201/165"]);
      expect(hits[0].alias).toBeNull();
    }
  });

  it("lands on the Korean card when searching an English alias", async () => {
    const { hits } = await searchCards("MEW 199/165");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      setCode: "sv2a",
      collectorNumber: "201/165",
      alias: { lang: "en", setCode: "MEW", collectorNumber: "199/165" },
    });
  });

  it("matches number-only queries across sets", async () => {
    const { hits } = await searchCards("205");
    expect(hits.map((h) => h.nameKo)).toEqual(["뮤 ex"]);
  });

  it("matches names in Korean and alias names", async () => {
    expect((await searchCards("리자몽")).hits.map((h) => h.nameKo)).toEqual(["리자몽 ex"]);
    expect((await searchCards("charizard")).hits.map((h) => h.nameKo)).toEqual(["리자몽 ex"]);
    expect((await searchCards("ex")).hits).toHaveLength(2);
  });

  it("returns nothing for a number that does not exist", async () => {
    expect((await searchCards("sv2a 999/165")).hits).toEqual([]);
  });
});
