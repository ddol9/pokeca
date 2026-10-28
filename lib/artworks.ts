import "server-only";
import { db } from "@/lib/supabase/server";
import {
  EXTENSION,
  promoteUpload,
  removeFiles,
  signedDownloadUrl,
  signedViewUrl,
  StorageInputError,
  type FileKind,
  type MimeType,
  type StoredFile,
} from "@/lib/storage";
import { FORMATS, type Format } from "@/lib/formats";
import { UUID } from "@/lib/uuid";

// 작품의 생성·상태·허락 변경은 이 모듈만 한다 (eng D5, D9, D10).
// 전이 규칙과 consent_events 기록은 DB 함수(artwork_functions.sql)가 한 트랜잭션에서 처리하고,
// 여기서는 커밋 뒤에 파일을 지운다. 삭제가 실패해도 DB가 기준이라 방문자에게는 이미 410이고,
// 남은 파일은 정리 작업(cleanup)이 다시 지운다.

export { FORMATS, type Format } from "@/lib/formats";
export type Status = "active" | "hidden" | "withdrawn";
export type ConsentLevel = "link_only" | "hosted";

export class ArtworkError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

const DB_ERROR_CODES = [
  "not_found",
  "withdrawn_is_final",
  "invalid_status",
  "hosted_needs_original",
  "thumbnail_needs_file",
  "link_only_needs_source",
];

function rethrow(error: { message: string }): never {
  if (DB_ERROR_CODES.includes(error.message)) throw new ArtworkError(error.message);
  throw error;
}

async function purgeAfterCommit(paths: string[]): Promise<boolean> {
  try {
    await removeFiles(paths);
    return true;
  } catch (e) {
    console.error("file purge failed; cleanup will retry", paths, e);
    return false;
  }
}

// 생성 ----------------------------------------------------------------------

export type NewArtwork = {
  id: string; // 어드민 폼이 만든 UUID. 재시도해도 같은 작품이 된다.
  cardId: string;
  artistName: string;
  format: Format;
  sourceUrl: string | null;
  sourceVisibility: "public" | "members_only" | null;
  consentLevel: ConsentLevel;
  thumbnailOk: boolean;
  printSizeVerified: boolean;
  evidencePath: string | null;
};

export async function createArtwork(
  input: NewArtwork,
  uploads: { original?: string; thumbnail?: string },
  actor: string,
): Promise<string> {
  if (!input.artistName.trim()) throw new ArtworkError("artist_required");
  if (!FORMATS.includes(input.format)) throw new ArtworkError("invalid_format");
  if (input.sourceUrl && !/^https?:\/\//.test(input.sourceUrl)) throw new ArtworkError("invalid_source_url");
  if (!!input.sourceUrl !== !!input.sourceVisibility) throw new ArtworkError("source_visibility_required");
  if (!UUID.test(input.id)) throw new ArtworkError("invalid_id");

  const files: StoredFile[] = [];
  try {
    for (const kind of ["original", "thumbnail"] as FileKind[]) {
      const uploadId = uploads[kind];
      if (uploadId) files.push(await promoteUpload(uploadId, input.id, kind));
    }
  } catch (e) {
    if (e instanceof StorageInputError) throw new ArtworkError(e.message);
    throw e;
  }

  const { data, error } = await db().rpc("artwork_create", {
    p_artwork: {
      id: input.id,
      card_id: input.cardId,
      artist_name: input.artistName.trim(),
      format: input.format,
      source_url: input.sourceUrl,
      source_visibility: input.sourceVisibility,
      consent_level: input.consentLevel,
      thumbnail_ok: input.thumbnailOk,
      print_size_verified: input.printSizeVerified,
      evidence_path: input.evidencePath,
    },
    p_files: files.map((f) => ({
      kind: f.kind,
      path: f.path,
      mime_type: f.mimeType,
      size_bytes: f.sizeBytes,
    })),
    p_actor: actor,
  });
  if (error) rethrow(error);
  return data as string;
}

// 상태·허락 ------------------------------------------------------------------

type ChangeResult = { changed: boolean; purged: boolean };

export async function setStatus(
  id: string,
  to: Status,
  opts: { reason?: string; actor: string },
): Promise<ChangeResult> {
  const { data, error } = await db().rpc("artwork_set_status", {
    p_id: id,
    p_to: to,
    p_reason: opts.reason ?? null,
    p_actor: opts.actor,
  });
  if (error) rethrow(error);
  const { changed, purge_paths } = data as { changed: boolean; purge_paths: string[] };
  return { changed, purged: await purgeAfterCommit(purge_paths) };
}

export async function setConsent(
  id: string,
  consent: { consentLevel: ConsentLevel; thumbnailOk: boolean },
  opts: { reason?: string; actor: string; evidencePath?: string },
): Promise<ChangeResult> {
  const { data, error } = await db().rpc("artwork_set_consent", {
    p_id: id,
    p_consent_level: consent.consentLevel,
    p_thumbnail_ok: consent.thumbnailOk,
    p_reason: opts.reason ?? null,
    p_actor: opts.actor,
    p_evidence_path: opts.evidencePath ?? null,
  });
  if (error) rethrow(error);
  const { changed, purge_paths } = data as { changed: boolean; purge_paths: string[] };
  return { changed, purged: await purgeAfterCommit(purge_paths) };
}

export async function attachFile(id: string, kind: FileKind, uploadId: string): Promise<void> {
  if (!UUID.test(id)) throw new ArtworkError("not_found");
  if (kind !== "original" && kind !== "thumbnail") throw new ArtworkError("invalid_kind");
  // 파일을 옮기기 전에 확인한다. 철회 작품에 옮긴 파일은 추적되지 않는다(정리 작업이 지우긴 한다).
  const { data: target, error: targetError } = await db().from("artworks").select("status").eq("id", id).maybeSingle();
  if (targetError) throw targetError;
  if (!target) throw new ArtworkError("not_found");
  if (target.status === "withdrawn") throw new ArtworkError("withdrawn_is_final");
  let file: StoredFile;
  try {
    file = await promoteUpload(uploadId, id, kind);
  } catch (e) {
    if (e instanceof StorageInputError) throw new ArtworkError(e.message);
    throw e;
  }
  const { data, error } = await db().rpc("artwork_attach_file", {
    p_id: id,
    p_kind: kind,
    p_path: file.path,
    p_mime_type: file.mimeType,
    p_size_bytes: file.sizeBytes,
  });
  if (error) rethrow(error);
  await purgeAfterCommit((data as { purge_paths: string[] }).purge_paths);
}

// 공개 목록 -------------------------------------------------------------------

// 공개 DTO (eng D6). 모양은 썸네일 허락으로, 행동은 보관 허락으로 정한다 (eng E3).
export type PublicArtwork = {
  id: string;
  artistName: string;
  format: Format;
  layout: "tile" | "row";
  action: "download" | "source";
  sourceUrl: string | null;
  sourceDomain: string | null;
  membersOnly: boolean;
  sourceDeleted: boolean;
  printSizeVerified: boolean;
};

type ArtworkRow = {
  id: string;
  artist_name: string;
  format: Format;
  source_url: string | null;
  source_visibility: "public" | "members_only" | null;
  consent_level: ConsentLevel;
  thumbnail_ok: boolean;
  link_status: string;
  print_size_verified: boolean;
  created_at: string;
  artwork_files: { kind: FileKind }[];
};

function toPublic(r: ArtworkRow): PublicArtwork & { rank: number; createdAt: string } {
  const has = (kind: FileKind) => r.artwork_files.some((f) => f.kind === kind);
  const download = r.consent_level === "hosted" && has("original");
  const layout = r.thumbnail_ok && has("thumbnail") ? "tile" : "row";
  const membersOnly = r.source_visibility === "members_only";
  const sourceDeleted = r.link_status === "deleted";
  // design 12A 순서: 다운로드 → 미리보기 링크 → 미리보기 없는 링크 → 카페 가입 필요 → 원본 삭제
  const rank = download ? 1 : sourceDeleted ? 5 : membersOnly ? 4 : layout === "tile" ? 2 : 3;
  let sourceDomain: string | null = null;
  try {
    sourceDomain = r.source_url ? new URL(r.source_url).hostname : null;
  } catch {}
  return {
    id: r.id,
    artistName: r.artist_name,
    format: r.format,
    layout,
    action: download ? "download" : "source",
    sourceUrl: r.source_url,
    sourceDomain,
    membersOnly,
    sourceDeleted,
    printSizeVerified: r.print_size_verified,
    rank,
    createdAt: r.created_at,
  };
}

// 구획(타일 → 행)이 먼저, 각 구획 안에서 12A 순서, 같은 순위는 최신 등록 순 (eng E4).
export function sortArtworks<T extends { layout: "tile" | "row"; rank: number; createdAt: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      (a.layout === b.layout ? 0 : a.layout === "tile" ? -1 : 1) ||
      a.rank - b.rank ||
      b.createdAt.localeCompare(a.createdAt),
  );
}

export async function listPublicArtworks(cardId: string): Promise<PublicArtwork[]> {
  const { data, error } = await db()
    .from("artworks")
    .select(
      "id, artist_name, format, source_url, source_visibility, consent_level, thumbnail_ok, link_status, print_size_verified, created_at, artwork_files(kind)",
    )
    .eq("card_id", cardId)
    .eq("status", "active")
    .returns<ArtworkRow[]>();
  if (error) throw error;
  return sortArtworks(data.map(toPublic)).map((item) => {
    const dto: Partial<typeof item> = { ...item };
    delete dto.rank;
    delete dto.createdAt;
    return dto as PublicArtwork;
  });
}

// 다운로드·썸네일 ---------------------------------------------------------------

type FileLookup = {
  id: string;
  status: Status;
  consent_level: ConsentLevel;
  thumbnail_ok: boolean;
  artist_name: string;
  format: Format;
  cards: { set_code: string; collector_number: string };
  artwork_files: { kind: FileKind; path: string; mime_type: MimeType }[];
};

async function lookup(id: string): Promise<FileLookup | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await db()
    .from("artworks")
    .select(
      "id, status, consent_level, thumbnail_ok, artist_name, format, cards(set_code, collector_number), artwork_files(kind, path, mime_type)",
    )
    .eq("id", id)
    .maybeSingle<FileLookup>();
  if (error) throw error;
  return data;
}

export type DownloadResult =
  | { kind: "ok"; url: string }
  | { kind: "not_found" } // 404
  | { kind: "unavailable" }; // 410: 숨김·철회·허락 밖 (eng E2)

// 서명 URL은 원본 = active ∧ hosted 일 때만 발급한다 (eng D10).
export async function resolveDownload(id: string): Promise<DownloadResult> {
  const a = await lookup(id);
  if (!a) return { kind: "not_found" };
  const original = a.artwork_files.find((f) => f.kind === "original");
  if (a.status !== "active" || a.consent_level !== "hosted" || !original) return { kind: "unavailable" };
  const filename = [a.cards.set_code, a.cards.collector_number.replace("/", "-"), a.artist_name, a.format]
    .join("_")
    .replace(/[\\/:*?"<>|\s]+/g, "-");
  return { kind: "ok", url: await signedDownloadUrl(original.path, `${filename}.${EXTENSION[original.mime_type]}`) };
}

// 썸네일 = active ∧ thumbnail_ok.
export async function resolveThumbnail(id: string): Promise<string | null> {
  const a = await lookup(id);
  const thumb = a?.artwork_files.find((f) => f.kind === "thumbnail");
  if (!a || !thumb || a.status !== "active" || !a.thumbnail_ok) return null;
  return signedViewUrl(thumb.path);
}
