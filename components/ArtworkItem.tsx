"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicArtwork } from "@/lib/artworks";
import { FORMAT_INFO } from "@/lib/formats";
import styles from "./ArtworkItem.module.css";

// 작품 하나 (design 4A, eng E3). 모양은 썸네일 허락(layout), 행동은 보관 허락(action)이 따로 정한다.
//   tile: 미리보기 + @작가 + 규격 + 행동      row: @작가 · 규격 · 출처 도메인 · 행동
export function ArtworkItem({ artwork, onReport }: { artwork: PublicArtwork; onReport: (a: PublicArtwork) => void }) {
  const label = FORMAT_INFO[artwork.format].label;
  return (
    <li className={artwork.layout === "tile" ? styles.tile : styles.row} data-testid="artwork">
      {artwork.layout === "tile" && (
        <div className={styles.preview}>
          {/* 서명 URL로 리다이렉트되는 상태 확인 경로라 next/image 최적화를 쓰지 않는다. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/thumbnails/${artwork.id}`}
            alt={`@${artwork.artistName}의 ${label} 확장 아트 도안`}
            loading="lazy"
            decoding="async"
          />
        </div>
      )}
      <div className={styles.body}>
        <p className={styles.meta}>
          <strong className={styles.artist}>@{artwork.artistName}</strong>
          <span> · {label}</span>
          {artwork.layout === "row" && artwork.sourceDomain && <span className={styles.domain}> · {artwork.sourceDomain}</span>}
        </p>
        <div className={styles.actions}>
          {artwork.action === "download" ? <DownloadAction artwork={artwork} /> : <SourceAction artwork={artwork} />}
          <MoreMenu artwork={artwork} onReport={onReport} />
        </div>
      </div>
    </li>
  );
}

function SourceLink({ artwork, children, className }: { artwork: PublicArtwork; children: React.ReactNode; className: string }) {
  return (
    <a
      href={artwork.sourceUrl!}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => {
        // 측정은 실패해도 이동을 막지 않는다.
        navigator.sendBeacon?.("/api/events", JSON.stringify({ type: "source_click", artworkId: artwork.id }));
      }}
    >
      {children}
      <span className="visually-hidden">(새 탭)</span>
    </a>
  );
}

function SourceAction({ artwork }: { artwork: PublicArtwork }) {
  if (artwork.sourceDeleted || !artwork.sourceUrl) {
    return (
      <>
        <button type="button" className={styles.sourceButton} disabled>
          원본 글 보기
        </button>
        <span className={styles.status}>원본 글이 사라졌어요</span>
      </>
    );
  }
  return (
    <>
      <SourceLink artwork={artwork} className={styles.sourceButton}>
        원본 글 보기 ↗
      </SourceLink>
      {artwork.membersOnly && <span className={styles.status}>카페 가입 필요</span>}
    </>
  );
}

type DownloadState = "idle" | "loading" | "failed" | "gone";
const NOTICE_KEY = "print-notice-shown";

function DownloadAction({ artwork }: { artwork: PublicArtwork }) {
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
      {artwork.sourceUrl && !artwork.sourceDeleted && (
        <SourceLink artwork={artwork} className={styles.secondaryLink}>
          원본 글 ↗
        </SourceLink>
      )}
      <div className={styles.feedback} role="status">
        {state === "failed" && <p className={styles.error}>파일을 준비하지 못했어요. 다시 시도해 주세요.</p>}
        {state === "gone" && <p className={styles.error}>이 도안은 더 이상 제공되지 않아요.</p>}
        {notice && (
          <div className={styles.notice}>
            <p>
              인쇄할 때 크기는 ‘실제 크기(100%)’로, ‘페이지에 맞추기’는 끄세요.{" "}
              {artwork.printSizeVerified && printSize
                ? `이 파일은 ${printSize}로 확인됐어요.`
                : "작가의 원본 글에 있는 인쇄 안내를 함께 확인하세요."}
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
