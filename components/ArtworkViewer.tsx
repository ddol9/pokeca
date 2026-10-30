"use client";

import { useEffect, useRef } from "react";
import type { PublicArtwork } from "@/lib/artworks";
import { FORMAT_INFO } from "@/lib/formats";
import { ArtistName, DownloadAction, SourceLink } from "./ArtworkItem";
import styles from "./ArtworkViewer.module.css";

// 도안 크게 보기. 사이트 안에서 감상하고 바로 받는다.
// 네이티브 <dialog>라 포커스 가두기와 Esc 닫기를 브라우저가 처리한다. 바깥(배경)을 눌러도 닫힌다.
export function ArtworkViewer({ artwork, onClose }: { artwork: PublicArtwork | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (artwork && !dialog.open) dialog.showModal();
    if (!artwork && dialog.open) dialog.close();
  }, [artwork]);

  const label = artwork ? FORMAT_INFO[artwork.format].label : "";
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      aria-labelledby="viewer-title"
    >
      {artwork && (
        <div className={styles.layout}>
          <div className={styles.image}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/thumbnails/${artwork.id}`} alt={`@${artwork.artistName}의 ${label} 확장 아트 도안`} />
          </div>
          <div className={styles.info}>
            <h2 id="viewer-title" className={styles.title}>
              <ArtistName artwork={artwork} /> · {label}
            </h2>
            <p className={styles.size}>{FORMAT_INFO[artwork.format].printSize}</p>
            <SourceLink artwork={artwork} />
            <div className={styles.actions}>
              <DownloadAction key={artwork.id} artwork={artwork} />
            </div>
          </div>
          <button type="button" className={styles.close} onClick={() => ref.current?.close()} aria-label="크게 보기 닫기">
            ✕
          </button>
        </div>
      )}
    </dialog>
  );
}
