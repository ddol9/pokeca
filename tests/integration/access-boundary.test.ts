import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

// eng D6: 공개 키(브라우저에 노출되는 키)로는 어떤 테이블도 읽거나 쓸 수 없어야 한다.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
  auth: { persistSession: false },
});
const sql = postgres(process.env.SUPABASE_DB_URL!);

afterAll(() => sql.end());

async function publicTables(): Promise<string[]> {
  const rows = await sql<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public' order by tablename`;
  return rows.map((r) => r.tablename);
}

describe("access boundary", () => {
  it("enables RLS with no policies on every public table", async () => {
    const rows = await sql<{ tablename: string; rowsecurity: boolean; policies: number }[]>`
      select t.tablename, t.rowsecurity,
             (select count(*)::int from pg_policies p
               where p.schemaname = 'public' and p.tablename = t.tablename) as policies
      from pg_tables t where t.schemaname = 'public'`;
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect({ table: r.tablename, rls: r.rowsecurity, policies: r.policies }).toEqual({
        table: r.tablename,
        rls: true,
        policies: 0,
      });
    }
  });

  it("returns no rows to the publishable key, even for seeded tables", async () => {
    for (const table of await publicTables()) {
      const { data, error } = await anon.from(table).select("*").limit(1);
      expect({ table, rows: error ? 0 : data!.length }).toEqual({ table, rows: 0 });
    }
  });

  it("rejects writes from the publishable key", async () => {
    const { error } = await anon
      .from("search_misses")
      .insert({ query: "anon write attempt" });
    expect(error).not.toBeNull();
  });

  it("does not let the publishable key execute public functions", async () => {
    const rows = await sql<{ proname: string }[]>`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and (has_function_privilege('anon', p.oid, 'execute')
          or has_function_privilege('authenticated', p.oid, 'execute'))`;
    expect(rows.map((r) => r.proname)).toEqual([]);
  });

  it("keeps both storage buckets private with size and type limits", async () => {
    const rows = await sql<
      { id: string; public: boolean; file_size_limit: number; allowed_mime_types: string[] }[]
    >`select id, public, file_size_limit::int, allowed_mime_types from storage.buckets order by id`;
    expect(rows).toEqual([
      {
        id: "artworks",
        public: false,
        file_size_limit: 104857600,
        // webp는 서버가 만드는 미리보기용. 업로드 서명 발급(createUpload)은 여전히 PNG·JPEG·PDF만 받는다.
        allowed_mime_types: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
      },
      {
        id: "consent-evidence",
        public: false,
        file_size_limit: 20971520,
        allowed_mime_types: ["image/png", "image/jpeg", "application/pdf"],
      },
    ]);
  });
});

describe("admin accounts", () => {
  it("cannot be created by public signup (설계: 일반 사용자 로그인 없음)", async () => {
    const { error } = await anon.auth.signUp({ email: `stranger-${Date.now()}@example.com`, password: "stranger-password-1" });
    expect(error?.message).toMatch(/signups not allowed/i);
  });
});
