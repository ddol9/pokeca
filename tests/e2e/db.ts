import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

// E2E 테스트 데이터 준비. 앱 코드(lib/)를 거치지 않고 로컬 DB·저장소에 직접 넣는다.
export const sql = postgres(process.env.SUPABASE_DB_URL!, { onnotice: () => {} });
const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});

export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3, 4]);

type Seed = {
  number?: string;
  artist?: string;
  format?: "9pocket" | "psa" | "brg";
  consent?: "hosted" | "link_only";
  thumbnail?: boolean;
  status?: "active" | "hidden" | "withdrawn";
  sourceUrl?: string | null;
  visibility?: "public" | "members_only";
  linkStatus?: string;
  printSizeVerified?: boolean;
};

export async function seedArtwork(s: Seed = {}): Promise<string> {
  const id = crypto.randomUUID();
  const consent = s.consent ?? "hosted";
  const thumbnail = s.thumbnail ?? true;
  const sourceUrl = s.sourceUrl === undefined ? "https://cafe.naver.com/example/1" : s.sourceUrl;
  const [card] = await sql<{ id: string }[]>`
    select id from cards where set_code = 'sv2a' and collector_number = ${s.number ?? "201/165"}`;
  await sql`insert into artworks (id, upload_id, card_id, artist_name, format, source_url, source_visibility,
      consent_level, thumbnail_ok, status, link_status, print_size_verified)
    values (${id}, ${id}, ${card.id}, ${s.artist ?? "e2e작가"}, ${s.format ?? "9pocket"}, ${sourceUrl},
      ${sourceUrl ? (s.visibility ?? "public") : null}, ${consent}, ${thumbnail}, ${s.status ?? "active"},
      ${s.linkStatus ?? "ok"}, ${s.printSizeVerified ?? false})`;
  const kinds = [...(consent === "hosted" ? ["original"] : []), ...(thumbnail ? ["thumbnail"] : [])];
  for (const kind of kinds) {
    const path = `artworks/${id}/${kind}-e2e`;
    const { error } = await service.storage.from("artworks").upload(path, PNG, { contentType: "image/png" });
    if (error) throw error;
    await sql`insert into artwork_files (artwork_id, kind, path, mime_type, size_bytes)
      values (${id}, ${kind}, ${path}, 'image/png', ${PNG.length})`;
  }
  return id;
}

export async function clearArtworks(): Promise<void> {
  await sql`truncate artworks, artwork_files, consent_events, reports, requests, card_demand cascade`;
  const objects = await sql<{ name: string }[]>`select name from storage.objects where bucket_id = 'artworks'`;
  if (objects.length) await service.storage.from("artworks").remove(objects.map((o) => o.name));
}
