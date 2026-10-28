"use client";

import { useEffect, useRef } from "react";
import type { PublicArtwork } from "@/lib/artworks";
import { FORMAT_INFO } from "@/lib/formats";
import { ReportForm } from "./ReportForm";
import styles from "./ReportDialog.module.css";

// 작품 ··· 메뉴의 "신고·내림 요청" 대화상자 (design 14A). 작품 ID는 자동으로 붙는다.
// 네이티브 <dialog>라 포커스 가두기와 Esc 닫기를 브라우저가 처리한다.
export function ReportDialog({ artwork, onClose }: { artwork: PublicArtwork | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (artwork && !dialog.open) dialog.showModal();
    if (!artwork && dialog.open) dialog.close();
  }, [artwork]);

  return (
    <dialog ref={ref} className={styles.dialog} onClose={onClose} aria-labelledby="report-title">
      {artwork && (
        <>
          <h2 id="report-title" className={styles.title}>
            신고·내림 요청
          </h2>
          <p className={styles.target}>
            @{artwork.artistName} · {FORMAT_INFO[artwork.format].label}
          </p>
          <ReportForm key={artwork.id} artworkId={artwork.id} onDone={onClose} />
        </>
      )}
    </dialog>
  );
}
