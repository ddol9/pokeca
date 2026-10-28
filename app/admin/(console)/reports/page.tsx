import { Suspense } from "react";
import Link from "next/link";
import { attachReport, resolveReport } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/admin";
import { findArtworksBySource, listReports, type AdminReport } from "@/lib/admin-data";
import { REASON_LABEL, STATUS_LABEL } from "@/lib/admin-labels";
import styles from "../../admin.module.css";

export const metadata = { title: "신고 · 어드민" };

// design 11A + eng E7: 미처리 신고 → (작품 없으면 URL로 찾아 연결) → 작품 화면에서 숨김·철회 → 처리 완료/대상 없음.
export default function ReportsPage() {
  return (
    <section className={`${styles.console} ${styles.wide}`}>
      <h1 className={styles.title}>신고</h1>
      <Suspense fallback={<p className={styles.muted}>불러오는 중…</p>}>
        <Reports />
      </Suspense>
    </section>
  );
}

async function Reports() {
  await requireAdmin();
  const reports = await listReports();
  const open = reports.filter((r) => r.status === "open");
  const closed = reports.filter((r) => r.status !== "open");
  return (
    <>
      <section aria-labelledby="open-heading">
        <h2 id="open-heading" className={styles.subtitle}>
          미처리 {open.length}건
        </h2>
        {open.length === 0 && <p className={styles.muted}>처리할 신고가 없어요.</p>}
        {open.map((r) => (
          <OpenReport key={r.id} report={r} />
        ))}
      </section>
      {closed.length > 0 && (
        <section aria-labelledby="closed-heading">
          <h2 id="closed-heading" className={styles.subtitle}>
            최근 처리
          </h2>
          {closed.map((r) => (
            <div key={r.id} className={styles.report}>
              <p>
                <strong>{r.status === "resolved" ? "처리 완료" : "대상 없음"}</strong> ·{" "}
                {REASON_LABEL[r.reason as keyof typeof REASON_LABEL] ?? r.reason} · {target(r)}
              </p>
              <p className={styles.muted}>
                {r.resolvedAt && new Date(r.resolvedAt).toLocaleString("ko-KR")}
                {r.resolutionNote ? ` · ${r.resolutionNote}` : ""}
              </p>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

function target(r: AdminReport) {
  if (r.artworkId) return <Link href={`/admin/artworks/${r.artworkId}`}>{r.artworkLabel}</Link>;
  return r.sourceUrl;
}

async function OpenReport({ report: r }: { report: AdminReport }) {
  const candidates = !r.artworkId && r.sourceUrl ? await findArtworksBySource(r.sourceUrl) : [];
  return (
    <div className={styles.report} data-testid="open-report">
      <p>
        <strong>{REASON_LABEL[r.reason as keyof typeof REASON_LABEL] ?? r.reason}</strong> ·{" "}
        {new Date(r.createdAt).toLocaleString("ko-KR")}
      </p>
      <p>대상: {target(r)}</p>
      {r.sourceUrl && r.artworkId && <p className={styles.muted}>신고한 주소: {r.sourceUrl}</p>}
      {r.message && <p>{r.message}</p>}
      {r.contact && <p className={styles.muted}>연락처: {r.contact}</p>}

      {!r.artworkId && (
        <div>
          <p className={styles.muted}>
            {candidates.length ? "같은 주소의 작품 후보 — 맞는 작품에 연결하세요." : "이 주소와 맞는 작품을 찾지 못했어요."}
          </p>
          {candidates.map((c) => (
            <form key={c.id} action={attachReport} className={styles.row}>
              <input type="hidden" name="reportId" value={r.id} />
              <input type="hidden" name="artworkId" value={c.id} />
              <span>
                {c.setCode} {c.collectorNumber} · @{c.artistName} · {STATUS_LABEL[c.status]}
              </span>
              <button type="submit" className={styles.secondary}>
                연결
              </button>
            </form>
          ))}
        </div>
      )}

      <form action={resolveReport} className={styles.row}>
        <input type="hidden" name="reportId" value={r.id} />
        <label className="visually-hidden" htmlFor={`note-${r.id}`}>
          처리 메모
        </label>
        <input id={`note-${r.id}`} name="note" placeholder="처리 메모" className={`${styles.input} ${styles.short}`} />
        <button type="submit" name="status" value="resolved" className={styles.primary}>
          처리 완료
        </button>
        <button type="submit" name="status" value="no_target" className={styles.secondary}>
          대상 없음
        </button>
      </form>
    </div>
  );
}
