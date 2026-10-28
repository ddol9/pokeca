import "server-only";
import { REASON_LABEL } from "@/lib/admin-labels";
import type { NewReport } from "@/lib/reports";

// 운영자 메일 알림 (eng T7). Resend REST API를 fetch로 부른다(SDK 의존성 없음).
// 알림은 부가 기능이다: 설정이 없거나 보내기에 실패해도 신고 저장은 이미 끝났고, 로그만 남긴다.
//
//   RESEND_API_KEY      Resend API 키. 없으면 서버 로그로만 남긴다(로컬·테스트).
//   REPORT_NOTIFY_TO    받는 주소(쉼표로 여러 개)
//   REPORT_NOTIFY_FROM  보내는 주소. Resend에서 인증한 도메인이어야 한다. 예: "확장 아트 <alerts@example.com>"

const RESEND_URL = "https://api.resend.com/emails";

export type ReportNotice = { id: string; report: NewReport; autoHidden: boolean; origin: string };

// 메일은 텍스트로만 보낸다. 방문자가 쓴 값이 HTML로 해석될 일이 없다.
export function reportEmail({ id, report, autoHidden, origin }: ReportNotice) {
  const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").slice(0, 120);
  const target = report.artworkId ? `${origin}/admin/artworks/${report.artworkId}` : report.sourceUrl ?? "";
  const subject = oneLine(
    `[신고${autoHidden ? "·자동 숨김" : ""}] ${REASON_LABEL[report.reason]} · ${report.artworkId ? "작품 지정" : "주소만"}`,
  );
  const text = [
    `사유: ${REASON_LABEL[report.reason]}`,
    autoHidden ? "서로 다른 대역 3곳에서 신고되어 작품을 자동으로 숨겼어요." : null,
    `대상: ${target}`,
    report.contact ? `연락처: ${report.contact}` : null,
    report.message ? `\n메모:\n${report.message}` : null,
    `\n신고 목록: ${origin}/admin/reports`,
    `신고 ID: ${id}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
  return { subject, text };
}

export async function notifyReport(notice: ReportNotice): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.REPORT_NOTIFY_TO;
  const from = process.env.REPORT_NOTIFY_FROM;
  if (!key || !to || !from) {
    console.info("report received (메일 설정 없음)", { id: notice.id, reason: notice.report.reason, autoHidden: notice.autoHidden });
    return;
  }
  const { subject, text } = reportEmail(notice);
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: to.split(",").map((s) => s.trim()).filter(Boolean), subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("report email failed", res.status, await res.text().catch(() => ""));
  } catch (e) {
    console.error("report email failed", e);
  }
}
