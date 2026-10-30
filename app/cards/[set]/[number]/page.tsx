import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AliasNote } from "@/components/AliasNote";
import { FormatResults } from "@/components/FormatResults";
import { listPublicArtworks } from "@/lib/artworks";
import { getCard } from "@/lib/cards";
import { numberFromPath, safeDecode } from "@/lib/search";
import styles from "./page.module.css";

const LANG_LABEL = { ja: "일본", en: "영문" } as const;

export default function CardPage(props: PageProps<"/cards/[set]/[number]">) {
  return (
    <Suspense>
      <Card params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Card({
  params,
  searchParams,
}: Pick<PageProps<"/cards/[set]/[number]">, "params" | "searchParams">) {
  const { set, number } = await params;
  const setCode = safeDecode(set);
  const collectorNumber = numberFromPath(number);
  if (setCode === null || collectorNumber === null) notFound();
  const card = await getCard(setCode, collectorNumber);
  if (!card) notFound();

  const [artworks, query] = await Promise.all([listPublicArtworks(card.cardId), searchParams]);
  const from = aliasFrom(query.from);

  // design 2A: 번호 블록이 기준점. 상자 없이 글자 크기·간격·구분선으로 위계를 만든다.
  return (
    <article className={styles.card}>
      {/* 모바일에서는 번호 줄이 위에 고정된다 (design 9A). sticky가 페이지 끝까지 유지되도록 article 바로 아래에 둔다. */}
      <div className={styles.sticky}>
        <h1 className={styles.number}>
          <span>{card.setCode}</span> <span>{card.collectorNumber}</span>
        </h1>
        <p className={styles.stickyName} aria-hidden="true">
          {card.nameKo}
        </p>
      </div>
      <header className={styles.identity}>
        <p className={styles.meta}>
          <strong className={styles.name}>{card.nameKo}</strong>
          {[card.rarity, card.setName, card.illustrator && `일러스트 ${card.illustrator}`]
            .filter(Boolean)
            .map((part) => (
              <span key={part as string}> · {part}</span>
            ))}
        </p>
        {from && (
          <AliasNote>
            입력한 {from.number}({LANG_LABEL[from.lang]}판)과 같은 그림의 한글판 카드예요. 도안은 한글판 기준이에요.
          </AliasNote>
        )}
      </header>
      {/* 공식 카드 이미지는 쓰지 않는다. 번호 블록 옆의 보조 요소로 중립 실루엣만 둔다 (design 2A). */}
      <div className={styles.silhouette} aria-hidden="true" />
      <FormatResults cardId={card.cardId} artworks={artworks} />
    </article>
  );
}

function aliasFrom(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const m = raw?.match(/^(ja|en):([^:]+):(.+)$/);
  return m ? { lang: m[1] as "ja" | "en", setCode: m[2], number: `${m[2]} ${m[3]}` } : null;
}
