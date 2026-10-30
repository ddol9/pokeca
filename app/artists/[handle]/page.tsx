import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArtistGallery } from "@/components/ArtistGallery";
import { getPortfolio } from "@/lib/artists";
import { safeDecode } from "@/lib/search";
import styles from "./page.module.css";

// 공개 작가 페이지. 승인된 작가의 공개 도안을 최신 순으로 모은다.
export async function generateMetadata(props: PageProps<"/artists/[handle]">): Promise<Metadata> {
  const { handle } = await props.params;
  return { title: `@${safeDecode(handle) ?? handle} · 확장 아트 아카이브` };
}

export default function ArtistPage(props: PageProps<"/artists/[handle]">) {
  return (
    <Suspense>
      <Portfolio params={props.params} />
    </Suspense>
  );
}

async function Portfolio({ params }: Pick<PageProps<"/artists/[handle]">, "params">) {
  const handle = safeDecode((await params).handle);
  const found = handle ? await getPortfolio(handle) : null;
  if (!found) notFound();
  const { artist, artworks } = found;
  return (
    <article className={styles.page}>
      <header className={styles.identity}>
        <h1 className={styles.name}>@{artist.displayName}</h1>
        {artist.intro && <p className={styles.intro}>{artist.intro}</p>}
        {artist.linkUrl && (
          <p>
            <a href={artist.linkUrl} target="_blank" rel="noopener noreferrer">
              작가가 작품을 올리는 곳 ↗<span className="visually-hidden">(새 탭)</span>
            </a>
          </p>
        )}
      </header>
      <section aria-labelledby="gallery-heading" className={styles.gallery}>
        <h2 id="gallery-heading" className={styles.heading}>
          확장 아트 도안 {artworks.length}개
        </h2>
        {artworks.length === 0 ? (
          <p className={styles.muted}>아직 공개한 도안이 없어요.</p>
        ) : (
          <ArtistGallery artworks={artworks} />
        )}
      </section>
    </article>
  );
}
