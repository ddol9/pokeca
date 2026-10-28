import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { createUpload, type FileKind } from "@/lib/storage";

export const sql = postgres(process.env.SUPABASE_DB_URL!, { onnotice: () => {} });

export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3, 4]);
export const PDF = new TextEncoder().encode("%PDF-1.7\n%test\n");
export const FAKE_PNG = new TextEncoder().encode("this is not a png at all");

// 브라우저처럼 공개 키 클라이언트로 서명 업로드 URL에 올린다.
const browser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false } },
);

export async function uploadAsBrowser(kind: FileKind, bytes: Uint8Array, mimeType: string): Promise<string> {
  const { uploadId, path, token } = await createUpload({ kind, mimeType, sizeBytes: bytes.length });
  const { error } = await browser.storage
    .from("artworks")
    .uploadToSignedUrl(path, token, new Blob([new Uint8Array(bytes)], { type: mimeType }), { contentType: mimeType });
  if (error) throw error;
  return uploadId;
}

export async function cardId(setCode = "sv2a", number = "201/165"): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    select id from cards where set_code = ${setCode} and collector_number = ${number}`;
  return row.id;
}

export async function resetArtworks(): Promise<void> {
  await sql`truncate artworks, artwork_files, consent_events, reports, requests, card_demand cascade`;
  const objects = await sql<{ name: string }[]>`select name from storage.objects where bucket_id = 'artworks'`;
  if (objects.length) {
    const { db } = await import("@/lib/supabase/server");
    await db().storage.from("artworks").remove(objects.map((o) => o.name));
  }
}

export async function storedPaths(): Promise<string[]> {
  const rows = await sql<{ name: string }[]>`
    select name from storage.objects where bucket_id = 'artworks' order by name`;
  return rows.map((r) => r.name);
}
