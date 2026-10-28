// 카드 시드 CSV 읽기와 검사 (설계 "카드 식별"). DB에 쓰는 일은 scripts/import-cards.ts가 한다.
// 이 파일은 다른 모듈을 import하지 않는다: Next 밖(node 스크립트)에서도 그대로 읽힌다.
//
// 컬럼: set_code, collector_number, name_ko, rarity, illustrator,
//       alias_set_code_ja, alias_number_ja, name_ja, alias_set_code_en, alias_number_en, name_en
//       (+ 선택: set_name_ko — DB에 없는 세트를 새로 만들 때만 필요)

export const REQUIRED_COLUMNS = ["set_code", "collector_number", "name_ko"] as const;
export const COLUMNS = [
  "set_code",
  "collector_number",
  "name_ko",
  "rarity",
  "illustrator",
  "alias_set_code_ja",
  "alias_number_ja",
  "name_ja",
  "alias_set_code_en",
  "alias_number_en",
  "name_en",
  "set_name_ko",
] as const;

export type ImportAlias = { lang: "ja" | "en"; set_code: string; collector_number: string; name: string | null };
export type ImportCard = {
  line: number;
  set_code: string;
  collector_number: string;
  name_ko: string;
  rarity: string | null;
  illustrator: string | null;
  aliases: ImportAlias[];
};
export type ImportSet = { code: string; name_ko: string };
export type ImportError = { line: number; message: string };
export type ParsedImport = { cards: ImportCard[]; sets: ImportSet[]; errors: ImportError[] };

// RFC 4180: 큰따옴표로 감싼 칸 안의 쉼표·줄바꿈·"" 이스케이프를 지원한다. 엑셀이 붙이는 BOM은 뗀다.
// 각 행에 시작 줄 번호를 붙여 오류 메시지가 편집기의 줄과 맞게 한다.
export function parseCsv(text: string): { line: number; cells: string[] }[] {
  const src = text.replace(/^﻿/, "");
  const rows: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let rowLine = 1;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        if (c === "\n") line++;
        cell += c;
      }
    } else if (c === '"' && cell === "") {
      quoted = true;
    } else if (c === ",") {
      cells.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      cells.push(cell);
      rows.push({ line: rowLine, cells });
      cells = [];
      cell = "";
      line++;
      rowLine = line;
    } else {
      cell += c;
    }
  }
  if (quoted) throw new Error(`${rowLine}행: 닫히지 않은 큰따옴표`);
  if (cell !== "" || cells.length) {
    cells.push(cell);
    rows.push({ line: rowLine, cells });
  }
  return rows.filter((r) => r.cells.some((c) => c.trim() !== ""));
}

const NUMBER = /^[0-9A-Za-z]+(?:[-/][0-9A-Za-z]+)*$/;

export function parseCardImport(text: string): ParsedImport {
  const errors: ImportError[] = [];
  let rows: ReturnType<typeof parseCsv>;
  try {
    rows = parseCsv(text);
  } catch (e) {
    return { cards: [], sets: [], errors: [{ line: 0, message: (e as Error).message }] };
  }
  const [header, ...body] = rows;
  if (!header) return { cards: [], sets: [], errors: [{ line: 0, message: "빈 파일" }] };

  const names = header.cells.map((h) => h.trim().toLowerCase());
  const unknown = names.filter((n) => !(COLUMNS as readonly string[]).includes(n));
  const missing = REQUIRED_COLUMNS.filter((c) => !names.includes(c));
  if (unknown.length) errors.push({ line: header.line, message: `알 수 없는 컬럼: ${unknown.join(", ")}` });
  if (missing.length) errors.push({ line: header.line, message: `필수 컬럼 없음: ${missing.join(", ")}` });
  if (errors.length) return { cards: [], sets: [], errors };

  const cards: ImportCard[] = [];
  const sets = new Map<string, ImportSet>();
  const seenCards = new Map<string, number>();
  const seenAliases = new Map<string, number>();

  for (const row of body) {
    const err = (message: string) => errors.push({ line: row.line, message });
    if (row.cells.length > names.length) {
      err(`칸이 ${row.cells.length}개로 헤더(${names.length}개)보다 많아요. 쉼표가 든 값은 큰따옴표로 감싸세요.`);
      continue;
    }
    const get = (name: string) => {
      const i = names.indexOf(name);
      const v = i < 0 ? "" : (row.cells[i] ?? "").normalize("NFKC").trim();
      return v === "" ? null : v;
    };

    const setCode = get("set_code")?.toLowerCase() ?? null;
    const number = get("collector_number")?.toUpperCase() ?? null;
    const nameKo = get("name_ko");
    if (!setCode || !number || !nameKo) {
      err("set_code, collector_number, name_ko는 비울 수 없어요.");
      continue;
    }
    if (!NUMBER.test(number)) {
      err(`collector_number 형식이 이상해요: ${number}`);
      continue;
    }

    const key = `${setCode} ${number}`;
    const first = seenCards.get(key);
    if (first) {
      err(`${key}가 ${first}행과 겹쳐요.`);
      continue;
    }
    seenCards.set(key, row.line);

    const setName = get("set_name_ko");
    if (setName) {
      const prev = sets.get(setCode);
      if (prev && prev.name_ko !== setName) {
        err(`세트 ${setCode}의 이름이 앞 행(${prev.name_ko})과 달라요.`);
        continue;
      }
      sets.set(setCode, { code: setCode, name_ko: setName });
    }

    const aliases: ImportAlias[] = [];
    let aliasOk = true;
    for (const lang of ["ja", "en"] as const) {
      const aSet = get(`alias_set_code_${lang}`);
      const aNumber = get(`alias_number_${lang}`)?.toUpperCase() ?? null;
      const aName = get(`name_${lang}`);
      if (!aSet && !aNumber) {
        if (aName) {
          err(`name_${lang}만 있고 alias_set_code_${lang}·alias_number_${lang}가 없어요.`);
          aliasOk = false;
        }
        continue;
      }
      if (!aSet || !aNumber) {
        err(`alias_set_code_${lang}와 alias_number_${lang}는 함께 채워야 해요.`);
        aliasOk = false;
        continue;
      }
      const aliasKey = `${lang} ${aSet.toUpperCase()} ${aNumber}`;
      const firstAlias = seenAliases.get(aliasKey);
      if (firstAlias) {
        err(`별칭 ${aliasKey}가 ${firstAlias}행과 겹쳐요.`);
        aliasOk = false;
        continue;
      }
      seenAliases.set(aliasKey, row.line);
      aliases.push({ lang, set_code: aSet, collector_number: aNumber, name: aName });
    }
    if (!aliasOk) continue;

    cards.push({
      line: row.line,
      set_code: setCode,
      collector_number: number,
      name_ko: nameKo,
      rarity: get("rarity"),
      illustrator: get("illustrator"),
      aliases,
    });
  }

  if (body.length === 0) errors.push({ line: header.line, message: "카드 행이 없어요." });
  return { cards, sets: [...sets.values()], errors };
}
