import { Suspense } from "react";
import Link from "next/link";
import { SearchForm } from "@/components/SearchForm";
import { recentArtworkCards } from "@/lib/cards";
import { cardPath } from "@/lib/search";
import styles from "./page.module.css";

// design 3A: 워드마크, 제목, 큰 검색창, "최근 도안이 등록된 카드" 6장.
export default function Home() {
  return (
    <section className={styles.home}>
      <h1 className={styles.title}>카드 번호로 확장 아트 찾기</h1>
      <SearchForm />
      <Suspense>
        <RecentCards />
      </Suspense>
    </section>
  );
}

async function RecentCards() {
  const cards = await recentArtworkCards(6);
  if (cards.length === 0) return null;
  return (
    <section aria-labelledby="recent-heading" className={styles.recent}>
      <h2 id="recent-heading" className={styles.recentHeading}>
        최근 도안이 등록된 카드
      </h2>
      <ul className={styles.recentList}>
        {cards.map((c) => (
          <li key={`${c.setCode}-${c.collectorNumber}`}>
            <Link href={cardPath(c.setCode, c.collectorNumber)} className={styles.recentLink}>
              <span className={styles.recentNumber}>
                {c.setCode} {c.collectorNumber}
              </span>
              <span className={styles.recentName}>{c.nameKo}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
