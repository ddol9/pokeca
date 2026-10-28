import "server-only";
import { createHmac } from "node:crypto";
import { db } from "@/lib/supabase/server";
import { setStatus } from "@/lib/artworks";
import { UUID } from "@/lib/uuid";

// 신고·내림 요청 (설계 "신고 흐름", design 14A).
//   저장 → (같은 작품에 24시간 안 서로 다른 IP 대역 3곳) 자동 숨김 → 어드민 검수
// IP는 남용 방지에만 쓴다. 대역으로 자른 뒤 서버 비밀값으로 HMAC해서 24시간 카운터에만 남긴다.

export const REASONS = ["rights_holder", "suspected_theft", "other"] as const;
export type Reason = (typeof REASONS)[number];

export class ReportError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

// IPv4는 /24, IPv6는 /48. 같은 집·회사에서 주소만 바꿔 여러 번 신고하는 것을 한 곳으로 센다.
export function ipRange(ip: string): string {
  const v4 = ip.match(/^(?:::ffff:)?(\d+)\.(\d+)\.(\d+)\.\d+$/i);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0/24`;
  if (ip.includes(":")) {
    const [head, tail = ""] = ip.toLowerCase().split("::");
    const left = head ? head.split(":") : [];
    const right = tail ? tail.split(":") : [];
    const full = [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right];
    return `${full.slice(0, 3).map((g) => parseInt(g || "0", 16).toString(16)).join(":")}::/48`;
  }
  return "unknown";
}

export function hashRange(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ipRange(ip)).digest("hex");
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
}

export type NewReport = {
  artworkId: string | null;
  sourceUrl: string | null;
  reason: Reason;
  contact: string | null;
  message: string | null;
};

export function parseReport(input: unknown): NewReport {
  if (!input || typeof input !== "object") throw new ReportError("invalid_reason");
  const body = input as Record<string, unknown>;
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const artworkId = text(body.artworkId, 36);
  const sourceUrl = text(body.sourceUrl, 2000);
  if (!REASONS.includes(body.reason as Reason)) throw new ReportError("invalid_reason");
  if (artworkId && !UUID.test(artworkId)) throw new ReportError("not_found");
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) throw new ReportError("invalid_source_url");
  if (!artworkId && !sourceUrl) throw new ReportError("target_required");
  return { artworkId, sourceUrl, reason: body.reason as Reason, contact: text(body.contact, 200), message: text(body.message, 2000) };
}

export async function submitReport(report: NewReport, ipHash: string): Promise<{ id: string; autoHidden: boolean }> {
  const { data, error } = await db().rpc("report_submit", {
    p_report: {
      artwork_id: report.artworkId,
      source_url: report.sourceUrl,
      reason: report.reason,
      contact: report.contact,
      message: report.message,
    },
    p_ip_hash: ipHash,
  });
  if (error) {
    if (error.message === "rate_limited" || error.message === "not_found") throw new ReportError(error.message);
    throw error;
  }
  const { id, auto_hide } = data as { id: string; auto_hide: boolean };
  let autoHidden = false;
  if (auto_hide && report.artworkId) {
    const result = await setStatus(report.artworkId, "hidden", {
      reason: "서로 다른 대역 3곳에서 신고되어 자동으로 숨김",
      actor: "system:reports",
    }).catch((e) => {
      // 이미 철회된 작품 등은 숨길 필요가 없다.
      console.error("auto hide failed", e);
      return null;
    });
    autoHidden = !!result?.changed;
  }
  return { id, autoHidden };
}
