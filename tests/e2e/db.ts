import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import sharp from "sharp";

// E2E 테스트 데이터 준비. 앱 코드(lib/)를 거치지 않고 로컬 DB·저장소에 직접 넣는다.
export const sql = postgres(process.env.SUPABASE_DB_URL!, { onnotice: () => {} });
const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});

export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3, 4]);
// 화면에 실제로 그려지는 작은 이미지(카드 비율). 서버가 미리보기를 만들 수 있는 진짜 PNG다.
// Playwright는 테스트를 CommonJS로 읽어 최상위 await를 쓸 수 없다. 처음 부를 때 만든다.
let preview: Promise<Buffer> | null = null;
export function previewPng(): Promise<Buffer> {
  preview ??= sharp({ create: { width: 63, height: 88, channels: 4, background: { r: 36, g: 69, b: 168, alpha: 1 } } })
    .png()
    .toBuffer();
  return preview;
}

type Seed = {
  number?: string;
  artist?: string;
  format?: "9pocket" | "psa" | "brg";
  status?: "active" | "hidden" | "withdrawn";
  sourceUrl?: string | null;
  visibility?: "public" | "members_only";
  linkStatus?: string;
  printSizeVerified?: boolean;
};

export async function seedArtwork(s: Seed = {}): Promise<string> {
  const id = crypto.randomUUID();
  const sourceUrl = s.sourceUrl === undefined ? "https://cafe.naver.com/example/1" : s.sourceUrl;
  const [card] = await sql<{ id: string }[]>`
    select id from cards where set_code = 'sv2a' and collector_number = ${s.number ?? "201/165"}`;
  await sql`insert into artworks (id, upload_id, card_id, artist_name, format, source_url, source_visibility,
      status, link_status, print_size_verified)
    values (${id}, ${id}, ${card.id}, ${s.artist ?? "e2e작가"}, ${s.format ?? "9pocket"}, ${sourceUrl},
      ${sourceUrl ? (s.visibility ?? "public") : null}, ${s.status ?? "active"},
      ${s.linkStatus ?? "ok"}, ${s.printSizeVerified ?? false})`;
  const bytes = await previewPng();
  for (const kind of ["original", "thumbnail"]) {
    const path = `artworks/${id}/${kind}-e2e`;
    const { error } = await service.storage.from("artworks").upload(path, bytes, { contentType: "image/png" });
    if (error) throw error;
    await sql`insert into artwork_files (artwork_id, kind, path, mime_type, size_bytes)
      values (${id}, ${kind}, ${path}, 'image/png', ${bytes.length})`;
  }
  return id;
}

export async function clearArtworks(): Promise<void> {
  await sql`truncate artworks, artwork_files, consent_events, reports, report_throttle, requests, card_demand, events cascade`;
  for (const bucket of ["artworks", "consent-evidence"]) {
    const objects = await sql<{ name: string }[]>`select name from storage.objects where bucket_id = ${bucket}`;
    if (objects.length) await service.storage.from(bucket).remove(objects.map((o) => o.name));
  }
}

// 작가 계정과 로그인 계정을 지운다(작품의 artist_id는 비워진다).
export async function clearArtists(): Promise<void> {
  const users = await sql<{ user_id: string }[]>`select user_id from artists`;
  for (const u of users) await service.auth.admin.deleteUser(u.user_id);
}

// 어드민 로그인용 계정. 공개 가입이 꺼져 있어 서비스 키로 만든다.
export const ADMIN = { email: "admin-e2e@example.com", password: "e2e-admin-password" };
export const NOT_ADMIN = { email: "visitor-e2e@example.com", password: "e2e-visitor-password" };

export async function ensureUser(user: { email: string; password: string }, admin: boolean): Promise<void> {
  const { data } = await service.auth.admin.listUsers();
  let found = data.users.find((u) => u.email === user.email);
  if (!found) {
    const created = await service.auth.admin.createUser({ ...user, email_confirm: true });
    if (created.error) throw created.error;
    found = created.data.user;
  }
  if (admin) {
    await sql`insert into admins (user_id, email) values (${found.id}, ${user.email}) on conflict do nothing`;
  }
}

// 카카오 로그인을 마친 것과 같은 브라우저 세션을 만든다. 실제 카카오 화면은 거치지 않는다.
// 계정은 비밀번호로 만들어 서버 쪽에서 로그인한 뒤, 공급자를 kakao로 표시하고 세션 쿠키를 넘긴다.
export async function socialSessionCookies(email: string, baseURL: string) {
  const password = "e2e-social-password";
  const { data } = await service.auth.admin.listUsers();
  let user = data.users.find((u) => u.email === email);
  if (!user) {
    const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw created.error;
    user = created.data.user;
  }
  const updated = await service.auth.admin.updateUserById(user.id, {
    password,
    app_metadata: { provider: "kakao", providers: ["kakao"] },
    user_metadata: { full_name: "카톡닉네임" },
  });
  if (updated.error) throw updated.error;
  return sessionCookies(email, password, baseURL);
}

// 비밀번호로 서버 쪽에서 로그인하고, 브라우저에 넣을 세션 쿠키를 돌려준다.
export async function sessionCookies(email: string, password: string, baseURL: string) {
  const jar = new Map<string, string>();
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const url = new URL(baseURL);
  return [...jar].map(([name, value]) => ({ name, value, domain: url.hostname, path: "/" }));
}
