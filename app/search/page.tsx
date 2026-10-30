import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { SearchForm } from "@/components/SearchForm";
import { SearchMissRequest } from "@/components/SearchMissRequest";
import { recordSearch, searchCards, type CardHit } from "@/lib/cards";
import { cardPath } from "@/lib/search";
import { visitorId } from "@/lib/visitor";
import styles from "./page.module.css";

export const metadata = { title: "검색 · 확장 아트 아카이브" };

export default function SearchPage(props: PageProps<"/search">) {
  return (
    <Suspense fallback={<SearchShell query="" />}>
      <Results searchParams={props.searchParams} />
    </Suspense>
  );
}

function SearchShell({ query, children }: { query: string; children?: React.ReactNode }) {
  return (
    <section className={styles.page}>
      <h1 className="visually-hidden">카드 검색</h1>
      <SearchForm defaultValue={query} size="compact" />
      <div aria-live="polite">{children}</div>
    </section>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.slice(0, 100) ?? "";
  if (!query.trim()) redirect("/");

  const result = await searchCards(query);
  const visitor = await visitorId();
  after(() => recordSearch(query, result, visitor).catch((e) => console.error("recordSearch", e)));

  // 1건이면 카드 상세로 바로 간다(design 6A). 별칭으로 맞았으면 안내 줄을 위해 표시를 붙인다.
  if (result.hits.length === 1) {
    const hit = result.hits[0];
    const from = hit.alias ? `?from=${hit.alias.lang}:${hit.alias.setCode}:${hit.alias.collectorNumber}` : "";
    redirect(cardPath(hit.setCode, hit.collectorNumber) + from);
  }

  if (result.hits.length === 0) {
    return (
      <SearchShell query={query}>
        <div className={styles.miss}>
          <h2 className={styles.missTitle}>‘{query}’에 맞는 카드를 못 찾았어요</h2>
          <p>
            세트 코드와 번호를 함께 넣어 보세요: <code>sv2a 201/165</code> 또는 <code>sv2a-201</code>
          </p>
          <SearchMissRequest
            query={query}
            label={result.parsed.kind === "name" ? "이 카드 찾기 요청" : "이 번호로 찾기 요청"}
          />
        </div>
      </SearchShell>
    );
  }

  return (
    <SearchShell query={query}>
      <h2 className={styles.count}>카드 {result.hits.length}장</h2>
      <CandidateTable hits={result.hits} />
    </SearchShell>
  );
}

// design 3A: 카드당 한 줄. 도안 많은 순, 같으면 최신 확장팩 순(DB가 정렬).
function CandidateTable({ hits }: { hits: CardHit[] }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">카드명</th>
          <th scope="col" className={styles.setCol}>확장팩</th>
          <th scope="col">세트·번호</th>
          <th scope="col" className={styles.rarityCol}>레어도</th>
          <th scope="col" className={styles.countCol}>도안</th>
        </tr>
      </thead>
      <tbody>
        {hits.map((hit) => (
          <tr key={hit.cardId} className={hit.artworkCount === 0 ? styles.empty : undefined}>
            <td>
              <Link href={cardPath(hit.setCode, hit.collectorNumber)} className={styles.cardLink}>
                {hit.nameKo}
              </Link>
            </td>
            <td className={styles.setCol}>{hit.setName}</td>
            <td className={styles.number}>
              {hit.setCode} {hit.collectorNumber}
            </td>
            <td className={styles.rarityCol}>{hit.rarity}</td>
            <td className={styles.countCol}>{hit.artworkCount === 0 ? "도안 없음" : `${hit.artworkCount}개`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
