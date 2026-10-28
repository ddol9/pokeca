import "server-only";
import { db } from "@/lib/supabase/server";
import { BUCKET, removeFiles } from "@/lib/storage";

// 하루 한 번 도는 정리 작업 (eng D4, D9). Vercel Cron이 /api/cron/cleanup을 부른다.
//   1. 24시간 지난 pending/ 업로드 (확정 전에 탭을 닫은 경우)
//   2. artworks/ 아래 24시간 지난 파일 중 artwork_files 행이 없는 것
//      (이동 후 행 생성 실패, 교체·허락 하향 뒤 삭제 실패, 철회 작품에 옮겨진 파일)
//   3. 철회됐는데 files_purged = false인 작품의 파일 (커밋 후 삭제 실패)
//   4. 24시간 지난 신고 남용 방지 카운터(report_throttle)
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

async function trackedPaths(): Promise<Set<string>> {
  const out = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db().from("artwork_files").select("path").order("path").range(from, from + PAGE - 1);
    if (error) throw error;
    for (const r of data) out.add(r.path as string);
    if (data.length < PAGE) return out;
  }
}

const isOlder = (createdAt: string | null, cutoff: Date) => !!createdAt && new Date(createdAt) < cutoff;

export type CleanupReport = { pending: number; orphaned: number; withdrawn: number; throttle: number };

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

  // 폴더 항목은 id가 null이다. 행 여부는 경로로만 본다(작품 ID를 쿼리에 넣지 않아 수가 늘어도 URL 길이 문제가 없다).
  // 목록을 먼저 읽고 행을 나중에 읽는다: 그 사이 확정된 파일은 행 쪽에 잡혀 지워지지 않는다.
  const candidates: string[] = [];
  for (const folder of (await listAll("artworks")).filter((f) => !f.id)) {
    for (const f of await listAll(`artworks/${folder.name}`)) {
      if (f.id && isOlder(f.created_at, cutoff)) candidates.push(`artworks/${folder.name}/${f.name}`);
    }
  }
  const tracked = await trackedPaths();
  const orphaned = candidates.filter((path) => !tracked.has(path));
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

  const { count: throttle, error: throttleError } = await db()
    .from("report_throttle")
    .delete({ count: "exact" })
    .lt("created_at", cutoff.toISOString());
  if (throttleError) throw throttleError;

  return { pending: stalePending.length, orphaned: orphaned.length, withdrawn: withdrawn.length, throttle: throttle ?? 0 };
}
