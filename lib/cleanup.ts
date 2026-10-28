import "server-only";
import { db } from "@/lib/supabase/server";
import { BUCKET, removeFiles } from "@/lib/storage";

// 하루 한 번 도는 정리 작업 (eng D4, D9). Vercel Cron이 /api/cron/cleanup을 부른다.
//   1. 24시간 지난 pending/ 업로드 (확정 전에 탭을 닫은 경우)
//   2. 작품 행이 없는 artworks/<id>/ 파일 중 24시간 지난 것 (이동 후 행 생성 실패)
//   3. 철회됐는데 files_purged = false인 작품의 파일 (커밋 후 삭제 실패)
// Supabase Storage 파일은 SQL로 지울 수 없어서 pg_cron 대신 앱 경로로 돈다.

const PAGE = 1000;

type Listed = { name: string; id: string | null; created_at: string | null };

async function listAll(prefix: string): Promise<Listed[]> {
  const out: Listed[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db().storage.from(BUCKET).list(prefix, { limit: PAGE, offset });
    if (error) throw error;
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}

const isOlder = (createdAt: string | null, cutoff: Date) => !!createdAt && new Date(createdAt) < cutoff;

export type CleanupReport = { pending: number; orphaned: number; withdrawn: number };

export async function cleanup(now = new Date()): Promise<CleanupReport> {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const bucket = db().storage.from(BUCKET);

  const stalePending = (await listAll("pending"))
    .filter((f) => f.id && isOlder(f.created_at, cutoff))
    .map((f) => `pending/${f.name}`);
  if (stalePending.length) {
    const { error } = await bucket.remove(stalePending);
    if (error) throw error;
  }

  // 폴더 항목은 id가 null이다.
  const folders = (await listAll("artworks")).filter((f) => !f.id).map((f) => f.name);
  const { data: rows, error: rowsError } = await db().from("artworks").select("id").in("id", folders.length ? folders : ["00000000-0000-0000-0000-000000000000"]);
  if (rowsError) throw rowsError;
  const known = new Set(rows.map((r) => r.id));
  const orphaned: string[] = [];
  for (const folder of folders.filter((f) => !known.has(f))) {
    for (const f of await listAll(`artworks/${folder}`)) {
      if (f.id && isOlder(f.created_at, cutoff)) orphaned.push(`artworks/${folder}/${f.name}`);
    }
  }
  if (orphaned.length) {
    const { error } = await bucket.remove(orphaned);
    if (error) throw error;
  }

  const { data: leftovers, error: leftoverError } = await db()
    .from("artwork_files")
    .select("path, artworks!inner(status, files_purged)")
    .eq("artworks.status", "withdrawn")
    .eq("artworks.files_purged", false);
  if (leftoverError) throw leftoverError;
  const withdrawn = leftovers.map((f) => f.path as string);
  await removeFiles(withdrawn);

  return { pending: stalePending.length, orphaned: orphaned.length, withdrawn: withdrawn.length };
}
