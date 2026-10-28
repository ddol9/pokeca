import { describe, expect, it } from "vitest";
import { parseCardImport, parseCsv } from "./card-import";

const HEADER =
  "set_code,collector_number,name_ko,rarity,illustrator,alias_set_code_ja,alias_number_ja,name_ja,alias_set_code_en,alias_number_en,name_en";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas, newlines inside quotes, CRLF and a BOM", () => {
    const rows = parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n"two\nlines",z\n');
    expect(rows).toEqual([
      { line: 1, cells: ["a", "b"] },
      { line: 2, cells: ["x, y", 'say "hi"'] },
      { line: 3, cells: ["two\nlines", "z"] },
    ]);
  });

  it("skips blank lines and keeps line numbers of the rows after them", () => {
    expect(parseCsv("a\n\nb").map((r) => r.line)).toEqual([1, 3]);
  });

  it("rejects an unclosed quote", () => {
    expect(() => parseCsv('a\n"open')).toThrow("닫히지 않은");
  });
});

describe("parseCardImport", () => {
  it("normalizes set codes, numbers and full-width characters, and collects aliases", () => {
    const { cards, errors } = parseCardImport(
      `${HEADER}\nSV2A,２０１/165,리자몽 ex,SAR,Mitsuhiro Arita,sv2a,201/165,リザードンex,MEW,199/165,Charizard ex\n`,
    );
    expect(errors).toEqual([]);
    expect(cards).toEqual([
      {
        line: 2,
        set_code: "sv2a",
        collector_number: "201/165",
        name_ko: "리자몽 ex",
        rarity: "SAR",
        illustrator: "Mitsuhiro Arita",
        aliases: [
          { lang: "ja", set_code: "sv2a", collector_number: "201/165", name: "リザードンex" },
          { lang: "en", set_code: "MEW", collector_number: "199/165", name: "Charizard ex" },
        ],
      },
    ]);
  });

  it("accepts columns in any order and without the optional ones", () => {
    const { cards, errors } = parseCardImport("name_ko,collector_number,set_code\n피카츄,1/100,sv9\n");
    expect(errors).toEqual([]);
    expect(cards[0]).toMatchObject({ set_code: "sv9", collector_number: "1/100", name_ko: "피카츄", aliases: [] });
  });

  it("reports every problem with its line number", () => {
    const { errors } = parseCardImport(
      [
        HEADER,
        "sv2a,201/165,리자몽 ex,,,,,,,,",
        "sv2a,201/165,중복,,,,,,,,",
        ",5/10,번호만,,,,,,,,",
        "sv2a,7/10,별칭 반쪽,,,,,,MEW,,",
        "sv2a,8/10,이름만,,,,,,,,Pikachu",
        "sv2a,9/10,쉼표,안 감쌈,,,,,,,,,",
        "sv2a,10 10,번호 이상,,,,,,,,",
      ].join("\n"),
    );
    expect(errors.map((e) => e.line)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(errors[0].message).toContain("2행과 겹쳐요");
  });

  it("rejects unknown or missing columns before reading rows", () => {
    expect(parseCardImport("set_code,number,name_ko\nsv2a,1,a").errors[0].message).toContain("알 수 없는 컬럼: number");
    expect(parseCardImport("set_code,name_ko\nsv2a,a").errors[0].message).toContain("collector_number");
  });

  it("rejects the same alias on two rows and conflicting set names", () => {
    const { errors } = parseCardImport(
      [
        "set_code,collector_number,name_ko,alias_set_code_en,alias_number_en,set_name_ko",
        "zz1,1/2,가,ZZ,1/2,세트",
        "zz1,2/2,나,ZZ,1/2,세트",
        "zz1,3/2,다,,,다른 이름",
      ].join("\n"),
    );
    expect(errors.map((e) => e.line)).toEqual([3, 4]);
  });

  it("says so when there are no card rows", () => {
    expect(parseCardImport(`${HEADER}\n`).errors[0].message).toContain("카드 행이 없어요");
  });
});
