"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicArtwork } from "@/lib/artworks";
import { FORMAT_INFO } from "@/lib/formats";
import styles from "./ArtworkItem.module.css";

// 작품 하나 (design 4A). 모든 작품은 사이트에 보관한 도안이다.
//   미리보기(누르면 크게 보기) + @작가 · 규격 + [다운로드] [···]
export function ArtworkItem({
  artwork,
  onView,
  onReport,
}: {
  artwork: PublicArtwork;
  onView: (a: PublicArtwork) => void;
  onReport: (a: PublicArtwork) => void;
}) {
  const label = FORMAT_INFO[artwork.format].label;
  return (
    <li className={styles.tile} data-testid="artwork">
      <button
        type="button"
        className={styles.preview}
        onClick={() => onView(artwork)}
        aria-label={`@${artwork.artistName}의 ${label} 도안 크게 보기`}
      >
        {/* 서명 URL로 리다이렉트되는 상태 확인 경로라 next/image 최적화를 쓰지 않는다. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/thumbnails/${artwork.id}`}
          alt={`@${artwork.artistName}의 ${label} 확장 아트 도안`}
          loading="lazy"
          decoding="async"
        />
      </button>
      <div className={styles.body}>
        <p className={styles.meta}>
          <strong className={styles.artist}>@{artwork.artistName}</strong>
          <span> · {label}</span>
        </p>
        <div className={styles.actions}>
          <DownloadAction artwork={artwork} />
          <MoreMenu artwork={artwork} onReport={onReport} />
        </div>
      </div>
    </li>
  );
}

// 출처 표시 링크. 측정은 실패해도 이동을 막지 않는다.
export function SourceLink({ artwork }: { artwork: PublicArtwork }) {
  if (!artwork.sourceUrl) return null;
  return (
    <span className={styles.source}>
      <a
        href={artwork.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          navigator.sendBeacon?.("/api/events", JSON.stringify({ type: "source_click", artworkId: artwork.id }));
        }}
      >
        작가 원본 글 ↗<span className="visually-hidden">(새 탭)</span>
      </a>
      {artwork.sourceDomain && <span className={styles.domain}> · {artwork.sourceDomain}</span>}
      {artwork.membersOnly && <span className={styles.domain}> · 카페 가입 필요</span>}
    </span>
  );
}

type DownloadState = "idle" | "loading" | "failed" | "gone";
const NOTICE_KEY = "print-notice-shown";

export function DownloadAction({ artwork }: { artwork: PublicArtwork }) {
  const router = useRouter();
  const [state, setState] = useState<DownloadState>("idle");
  const [notice, setNotice] = useState(false);

  async function download() {
    setState("loading");
    try {
      const res = await fetch(`/api/download/${artwork.id}`, { method: "POST" });
      if (res.status === 410 || res.status === 404) {
        setState("gone");
        router.refresh();
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const { url } = await res.json();
      // 서명 URL은 클릭 시점에 받아 바로 쓰고 화면에 남기지 않는다 (design 6A).
      const a = document.createElement("a");
      a.href = url;
      a.rel = "noopener";
      document.body.append(a);
      a.click();
      a.remove();
      setState("idle");
      // 인쇄 안내는 같은 세션에서 한 번만 (design 7A).
      let shown = false;
      try {
        shown = sessionStorage.getItem(NOTICE_KEY) === "1";
        sessionStorage.setItem(NOTICE_KEY, "1");
      } catch {}
      if (!shown) setNotice(true);
    } catch {
      setState("failed");
    }
  }

  const printSize = FORMAT_INFO[artwork.format].printSize;
  return (
    <>
      <button
        type="button"
        className={styles.downloadButton}
        onClick={download}
        disabled={state === "loading" || state === "gone"}
        aria-label={`@${artwork.artistName} ${FORMAT_INFO[artwork.format].label} 도안 다운로드`}
      >
        {state === "loading" ? "준비 중…" : "다운로드"}
      </button>
      <div className={styles.feedback} role="status">
        {state === "failed" && <p className={styles.error}>파일을 준비하지 못했어요. 다시 시도해 주세요.</p>}
        {state === "gone" && <p className={styles.error}>이 도안은 더 이상 제공되지 않아요.</p>}
        {notice && (
          <div className={styles.notice}>
            <p>
              인쇄할 때 크기는 ‘실제 크기(100%)’로, ‘페이지에 맞추기’는 끄세요.{" "}
              {artwork.printSizeVerified && printSize
                ? `이 파일은 ${printSize}로 확인됐어요.`
                : artwork.sourceUrl
                  ? "작가의 원본 글에 있는 인쇄 안내를 함께 확인하세요."
                  : `${FORMAT_INFO[artwork.format].label} 규격에 맞춰 인쇄하세요.`}
            </p>
            <button type="button" className={styles.noticeClose} onClick={() => setNotice(false)}>
              닫기
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function MoreMenu({ artwork, onReport }: { artwork: PublicArtwork; onReport: (a: PublicArtwork) => void }) {
  const [open, setOpen] = useState(false);
  const menuId = `more-${artwork.id}`;
  return (
    <div className={styles.more}>
      <button
        type="button"
        className={styles.moreButton}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`@${artwork.artistName} 도안 더보기`}
        onClick={() => setOpen((v) => !v)}
      >
        ···
      </button>
      {open && (
        <div id={menuId} className={styles.menu}>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              setOpen(false);
              onReport(artwork);
            }}
          >
            신고·내림 요청
          </button>
        </div>
      )}
    </div>
  );
}
