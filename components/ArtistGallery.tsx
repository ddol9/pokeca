"use client";

import { useState } from "react";
import type { PortfolioArtwork } from "@/lib/artists";
import type { PublicArtwork } from "@/lib/artworks";
import { ArtworkItem } from "./ArtworkItem";
import { ArtworkViewer } from "./ArtworkViewer";
import { ReportDialog } from "./ReportDialog";
import styles from "./FormatResults.module.css";

// 작가 페이지의 도안 그리드. 카드 페이지와 같은 타일·크게 보기·신고를 쓰고, 타일마다 카드 번호를 붙인다.
export function ArtistGallery({ artworks }: { artworks: PortfolioArtwork[] }) {
  const [viewing, setViewing] = useState<PublicArtwork | null>(null);
  const [reporting, setReporting] = useState<PublicArtwork | null>(null);
  return (
    <>
      <ul className={styles.grid} aria-label="도안">
        {artworks.map((a) => (
          <ArtworkItem key={a.id} artwork={a} card={a.card} onView={setViewing} onReport={setReporting} />
        ))}
      </ul>
      <ArtworkViewer artwork={viewing} onClose={() => setViewing(null)} />
      <ReportDialog artwork={reporting} onClose={() => setReporting(null)} />
    </>
  );
}
