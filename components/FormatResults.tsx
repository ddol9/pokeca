"use client";

import { useEffect, useState } from "react";
import type { PublicArtwork } from "@/lib/artworks";
import { FORMAT_INFO, FORMATS, type Format } from "@/lib/formats";
import { ArtworkItem } from "./ArtworkItem";
import { ReportDialog } from "./ReportDialog";
import styles from "./FormatResults.module.css";

// 카드 상세의 작품 영역 (design 2A ③④, 5A, eng E4·E5·R8).
//   [전체][9포켓][PSA][BRG] ─ 선택 ─┬─ 작품 있음 → 위 타일 그리드 + 아래 한 줄 행 (서버가 정렬해 둠)
//                                  ├─ 그 규격 0개 → "이 카드의 {규격} 도안 찾아 주세요" + [찾기 요청]
//                                  └─ 카드 전체 0개(전체) → "어떤 규격이 필요하세요?" + 규격 버튼 3개
// 요청 상태는 방문자별이라 마운트 뒤 따로 불러온다(페이지 HTML은 방문자와 무관).

type Filter = "all" | Format;
type RequestStatus = { requested: boolean; waiting: number | null };
type Pending = { format: Format; phase: "sending" | "failed" } | null;

export function FormatResults({ cardId, artworks }: { cardId: string; artworks: PublicArtwork[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [reporting, setReporting] = useState<PublicArtwork | null>(null);
  const [requests, setRequests] = useState<Record<Format, RequestStatus> | null>(null);
  const [pending, setPending] = useState<Pending>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/cards/${cardId}/requests`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => !cancelled && data && setRequests(data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cardId]);

  async function request(format: Format) {
    setPending({ format, phase: "sending" });
    try {
      const res = await fetch(`/api/cards/${cardId}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setRequests(await res.json());
      setPending(null);
    } catch {
      setPending({ format, phase: "failed" });
    }
  }

  const counts = Object.fromEntries(FORMATS.map((f) => [f, artworks.filter((a) => a.format === f).length])) as Record<
    Format,
    number
  >;
  const shown = filter === "all" ? artworks : artworks.filter((a) => a.format === filter);
  const tiles = shown.filter((a) => a.layout === "tile");
  const rows = shown.filter((a) => a.layout === "row");
  const filterLabel = filter === "all" ? "전체" : FORMAT_INFO[filter].label;

  return (
    <section aria-labelledby="artworks-heading" className={styles.section}>
      <div className={styles.bar}>
        <h2 id="artworks-heading" className={styles.heading}>
          확장 아트 도안 {artworks.length}개
        </h2>
        <div className={styles.chips} role="group" aria-label="규격">
          {(["all", ...FORMATS] as Filter[]).map((f) => {
            const count = f === "all" ? artworks.length : counts[f];
            return (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                className={`${styles.chip} ${count === 0 && f !== "all" ? styles.chipEmpty : ""}`}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "전체" : FORMAT_INFO[f].label}
                {f !== "all" && <span className={styles.chipCount}>{count}</span>}
                {f !== "all" && requests?.[f]?.requested && count === 0 && (
                  <span className={styles.chipRequested}>요청함</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <p className="visually-hidden" aria-live="polite">
        {filterLabel} 도안 {shown.length}개
      </p>

      {shown.length === 0 ? (
        filter === "all" ? (
          <FindRequestAny requests={requests} pending={pending} onRequest={request} />
        ) : (
          <FindRequest format={filter} status={requests?.[filter]} pending={pending} onRequest={request} />
        )
      ) : (
        <>
          {tiles.length > 0 && (
            <ul className={styles.grid} aria-label="미리보기가 있는 도안">
              {tiles.map((a) => (
                <ArtworkItem key={a.id} artwork={a} onReport={setReporting} />
              ))}
            </ul>
          )}
          {rows.length > 0 && (
            <ul className={styles.rows} aria-label={tiles.length ? "미리보기가 없는 도안" : "도안"}>
              {rows.map((a) => (
                <ArtworkItem key={a.id} artwork={a} onReport={setReporting} />
              ))}
            </ul>
          )}
        </>
      )}

      <ReportDialog artwork={reporting} onClose={() => setReporting(null)} />
    </section>
  );
}

type RequestProps = {
  pending: Pending;
  onRequest: (format: Format) => void;
};

function Waiting({ status }: { status?: RequestStatus }) {
  return status?.waiting ? <p className={styles.waiting}>{status.waiting}명이 기다리는 중</p> : null;
}

function Failed({ pending, format }: { pending: Pending; format?: Format }) {
  return pending?.phase === "failed" && (!format || pending.format === format) ? (
    <p className={styles.failed}>기록하지 못했어요. 다시 시도해 주세요.</p>
  ) : null;
}

function FindRequest({ format, status, pending, onRequest }: RequestProps & { format: Format; status?: RequestStatus }) {
  const label = FORMAT_INFO[format].label;
  const sending = pending?.format === format && pending.phase === "sending";
  return (
    <div className={styles.empty}>
      <h3 className={styles.emptyTitle}>이 카드의 {label} 도안 찾아 주세요</h3>
      {status?.requested ? (
        <p className={styles.done}>요청이 기록됐어요 · 등록되면 이 페이지에 나타나요</p>
      ) : (
        <>
          <p className={styles.emptyHint}>기존 도안을 찾아 등록할 때 참고해요</p>
          <button type="button" className={styles.requestButton} disabled={sending} onClick={() => onRequest(format)}>
            {sending ? "기록 중…" : "찾기 요청"}
          </button>
        </>
      )}
      <div role="status">
        <Failed pending={pending} format={format} />
      </div>
      <Waiting status={status} />
    </div>
  );
}

// 카드 전체에 도안이 없을 때: 규격을 골라 요청한다 (eng E5).
function FindRequestAny({ requests, pending, onRequest }: RequestProps & { requests: Record<Format, RequestStatus> | null }) {
  const requestedAny = FORMATS.some((f) => requests?.[f]?.requested);
  return (
    <div className={styles.empty}>
      <h3 className={styles.emptyTitle}>아직 등록된 도안이 없어요. 어떤 규격이 필요하세요?</h3>
      <p className={styles.emptyHint}>
        {requestedAny ? "요청이 기록됐어요 · 등록되면 이 페이지에 나타나요" : "기존 도안을 찾아 등록할 때 참고해요"}
      </p>
      <div className={styles.formatButtons}>
        {FORMATS.map((f) => {
          const done = requests?.[f]?.requested;
          const sending = pending?.format === f && pending.phase === "sending";
          return (
            <div key={f} className={styles.formatOption}>
              <button type="button" className={styles.requestButton} disabled={done || sending} onClick={() => onRequest(f)}>
                {sending ? "기록 중…" : done ? `${FORMAT_INFO[f].label} 요청함` : `${FORMAT_INFO[f].label} 찾기 요청`}
              </button>
              <Waiting status={requests?.[f]} />
            </div>
          );
        })}
      </div>
      <div role="status">
        <Failed pending={pending} />
      </div>
    </div>
  );
}
