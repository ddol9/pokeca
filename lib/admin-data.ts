import "server-only";
import { db } from "@/lib/supabase/server";
import { ArtworkError, type Format, type Status } from "@/lib/artworks";
import { signedEvidenceUrl } from "@/lib/storage";
import { UUID } from "@/lib/uuid";

// 어드민 화면 조회와 간단한 기록 (design 11A, eng E6·E7). 호출자는 currentAdmin()을 먼저 확인한다.

export const LINK_STATUSES = ["unchecked", "ok", "deleted", "no_access", "suspect"] as const;
export type LinkStatus = (typeof LINK_STATUSES)[number];
export const CHECK_INTERVAL_DAYS = 7;

export type AdminArtworkRow = {
  id: string;
  setCode: string;
  collectorNumber: string;
  artistName: string;
  format: Format;
  status: Status;
  sourceUrl: string | null;
  sourceVisibility: "public" | "members_only" | null;
  linkStatus: LinkStatus;
  linkCheckedAt: string | null;
  needsCheck: boolean;
  createdAt: string;
};

type Row = {
  id: string;
  artist_name: string;
  format: Format;
  status: Status;
  source_url: string | null;
  source_visibility: "public" | "members_only" | null;
  link_status: LinkStatus;
  link_checked_at: string | null;
  created_at: string;
  cards: { set_code: string; collector_number: string };
};

const BASE =
  "id, artist_name, format, status, source_url, source_visibility, link_status, link_checked_at, created_at";
const COLUMNS = `${BASE}, cards(set_code, collector_number)`;

// 점검 필요 = 원본 링크가 있고, 7일 넘게 점검 안 했거나 의심 표시 (eng E6).
export function needsCheck(r: { source_url: string | null; status: Status; link_status: LinkStatus; link_checked_at: string | null }, now = new Date()) {
  if (!r.source_url || r.status === "withdrawn") return false;
  if (r.link_status === "suspect" || !r.link_checked_at) return true;
  return now.getTime() - new Date(r.link_checked_at).getTime() > CHECK_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
}

function toAdminRow(r: Row, now: Date): AdminArtworkRow {
  return {
    id: r.id,
    setCode: r.cards.set_code,
    collectorNumber: r.cards.collector_number,
    artistName: r.artist_name,
    format: r.format,
    status: r.status,
    sourceUrl: r.source_url,
    sourceVisibility: r.source_visibility,
    linkStatus: r.link_status,
    linkCheckedAt: r.link_checked_at,
    needsCheck: needsCheck(r, now),
    createdAt: r.created_at,
  };
}

export type ArtworkFilter = { status?: Status; linkStatus?: LinkStatus; needsCheck?: boolean };

// 작품 수가 수백 개 수준이라 한 번에 읽고 서버에서 거른다. 점검 필요가 먼저, 그 안에서 최신 순.
export async function listAdminArtworks(filter: ArtworkFilter = {}, now = new Date()): Promise<AdminArtworkRow[]> {
  let query = db().from("artworks").select(COLUMNS).order("created_at", { ascending: false }).limit(1000);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.linkStatus) query = query.eq("link_status", filter.linkStatus);
  const { data, error } = await query.returns<Row[]>();
  if (error) throw error;
  const rows = data.map((r) => toAdminRow(r, now));
  return (filter.needsCheck ? rows.filter((r) => r.needsCheck) : rows).sort(
    (a, b) => Number(b.needsCheck) - Number(a.needsCheck),
  );
}

export async function setLinkStatus(id: string, status: LinkStatus): Promise<void> {
  const { error } = await db().rpc("artwork_set_link_status", { p_id: id, p_status: status });
  if (error) {
    if (error.message === "not_found" || error.message === "invalid_link_status") throw new ArtworkError(error.message);
    throw error;
  }
}

export type ConsentEvent = {
  id: number;
  kind: "created" | "status" | "consent";
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  evidencePath: string | null;
  actor: string;
  createdAt: string;
};

export type AdminArtworkDetail = AdminArtworkRow & {
  cardName: string;
  printSizeVerified: boolean;
  files: { kind: "original" | "thumbnail"; mimeType: string; sizeBytes: number }[];
  events: ConsentEvent[];
  reports: { id: string; reason: string; status: string; createdAt: string }[];
};

export async function getAdminArtwork(id: string, now = new Date()): Promise<AdminArtworkDetail | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await db()
    .from("artworks")
    .select(
      `${BASE}, print_size_verified, cards(set_code, collector_number, name_ko), artwork_files(kind, mime_type, size_bytes), consent_events(id, kind, before, after, reason, evidence_path, actor, created_at), reports(id, reason, status, created_at)`,
    )
    .eq("id", id)
    .maybeSingle<
      Row & {
        print_size_verified: boolean;
        cards: { set_code: string; collector_number: string; name_ko: string };
        artwork_files: { kind: "original" | "thumbnail"; mime_type: string; size_bytes: number }[];
        consent_events: {
          id: number;
          kind: ConsentEvent["kind"];
          before: Record<string, unknown> | null;
          after: Record<string, unknown> | null;
          reason: string | null;
          evidence_path: string | null;
          actor: string;
          created_at: string;
        }[];
        reports: { id: string; reason: string; status: string; created_at: string }[];
      }
    >();
  if (error) throw error;
  if (!data) return null;
  return {
    ...toAdminRow(data, now),
    cardName: data.cards.name_ko,
    printSizeVerified: data.print_size_verified,
    files: data.artwork_files.map((f) => ({ kind: f.kind, mimeType: f.mime_type, sizeBytes: f.size_bytes })),
    events: data.consent_events
      .map((e) => ({
        id: e.id,
        kind: e.kind,
        before: e.before,
        after: e.after,
        reason: e.reason,
        evidencePath: e.evidence_path,
        actor: e.actor,
        createdAt: e.created_at,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id),
    reports: data.reports
      .map((r) => ({ id: r.id, reason: r.reason, status: r.status, createdAt: r.created_at }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

// 허락 근거 (설계 R3). 이벤트 ID로만 찾는다: 기록된 경로만 서명하고 임의 경로는 받지 않는다.
export async function evidenceUrl(eventId: string): Promise<string | null> {
  if (!/^[1-9]\d{0,17}$/.test(eventId)) return null;
  const { data, error } = await db().from("consent_events").select("evidence_path").eq("id", eventId).maybeSingle();
  if (error) throw error;
  return data?.evidence_path ? signedEvidenceUrl(data.evidence_path) : null;
}

// 신고 (eng E7) ----------------------------------------------------------------

export type ReportStatus = "open" | "resolved" | "no_target";

export type AdminReport = {
  id: string;
  artworkId: string | null;
  artworkLabel: string | null;
  sourceUrl: string | null;
  reason: string;
  contact: string | null;
  message: string | null;
  status: ReportStatus;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export async function listReports(): Promise<AdminReport[]> {
  const select =
    "id, artwork_id, source_url, reason, contact, message, status, resolution_note, resolved_at, created_at, artworks(artist_name, format, cards(set_code, collector_number))";
  type R = {
    id: string;
    artwork_id: string | null;
    source_url: string | null;
    reason: string;
    contact: string | null;
    message: string | null;
    status: ReportStatus;
    resolution_note: string | null;
    resolved_at: string | null;
    created_at: string;
    artworks: { artist_name: string; format: string; cards: { set_code: string; collector_number: string } } | null;
  };
  const [open, closed] = await Promise.all([
    db().from("reports").select(select).eq("status", "open").order("created_at", { ascending: true }).returns<R[]>(),
    db().from("reports").select(select).neq("status", "open").order("resolved_at", { ascending: false }).limit(20).returns<R[]>(),
  ]);
  if (open.error) throw open.error;
  if (closed.error) throw closed.error;
  return [...open.data, ...closed.data].map((r) => ({
    id: r.id,
    artworkId: r.artwork_id,
    artworkLabel: r.artworks
      ? `${r.artworks.cards.set_code} ${r.artworks.cards.collector_number} · @${r.artworks.artist_name} · ${r.artworks.format}`
      : null,
    sourceUrl: r.source_url,
    reason: r.reason,
    contact: r.contact,
    message: r.message,
    status: r.status,
    resolutionNote: r.resolution_note,
    resolvedAt: r.resolved_at,
    createdAt: r.created_at,
  }));
}

// 작품 없는 신고의 URL로 후보 작품을 찾는다. 쿼리 문자열·해시 차이는 무시한다.
export async function findArtworksBySource(url: string): Promise<AdminArtworkRow[]> {
  let key = url.trim();
  try {
    const u = new URL(key);
    key = `${u.host}${u.pathname}`.replace(/\/$/, "");
  } catch {}
  if (!key) return [];
  const pattern = `%${key.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const { data, error } = await db().from("artworks").select(COLUMNS).ilike("source_url", pattern).limit(10).returns<Row[]>();
  if (error) throw error;
  const now = new Date();
  return data.map((r) => toAdminRow(r, now));
}

export async function linkReport(reportId: string, artworkId: string): Promise<void> {
  const { error, count } = await db()
    .from("reports")
    .update({ artwork_id: artworkId }, { count: "exact" })
    .eq("id", reportId)
    .eq("status", "open");
  if (error) throw error;
  if (!count) throw new ArtworkError("not_found");
}

export async function closeReport(reportId: string, status: Exclude<ReportStatus, "open">, note: string): Promise<void> {
  const { error, count } = await db()
    .from("reports")
    .update({ status, resolution_note: note.trim() || null, resolved_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", reportId)
    .eq("status", "open");
  if (error) throw error;
  if (!count) throw new ArtworkError("not_found");
}
