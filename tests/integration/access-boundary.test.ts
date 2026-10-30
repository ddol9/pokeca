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

describe("public signup", () => {
  // 작가 소셜 로그인 때문에 가입은 열려 있다(Supabase는 이메일 가입만 따로 막을 수 없다).
  // 이렇게 만든 이메일 계정은 어드민도 작가도 아니다. 화면에서 막히는지는 e2e artist.spec이 확인한다.
  it("creates an email account with no admin or artist record", async () => {
    const { data, error } = await anon.auth.signUp({
      email: `stranger-${Date.now()}@example.com`,
      password: "stranger-password-1",
    });
    expect(error).toBeNull();
    const id = data.user!.id;
    expect(data.user!.app_metadata.provider).toBe("email");
    expect(await sql`select 1 from admins where user_id = ${id}`).toHaveLength(0);
    expect(await sql`select 1 from artists where user_id = ${id}`).toHaveLength(0);
    await sql`delete from auth.users where id = ${id}`;
  });
});
