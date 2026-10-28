import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getCard } from "@/lib/cards";
import { numberFromPath } from "@/lib/search";
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
  const card = await getCard(decodeURIComponent(set), numberFromPath(number));
  if (!card) notFound();

  const from = aliasFrom((await searchParams).from);

  // design 2A: 번호 블록이 기준점. 상자 없이 글자 크기·간격·구분선으로 위계를 만든다.
  return (
    <article className={styles.card}>
      <header className={styles.identity}>
        <h1 className={styles.number}>
          <span>{card.setCode}</span> <span>{card.collectorNumber}</span>
        </h1>
        <p className={styles.meta}>
          <strong className={styles.name}>{card.nameKo}</strong>
          {[card.rarity, card.setName, card.illustrator && `일러스트 ${card.illustrator}`]
            .filter(Boolean)
            .map((part) => (
              <span key={part as string}> · {part}</span>
            ))}
        </p>
        {from && (
          <p className={styles.aliasNote}>
            입력한 {from.number}({LANG_LABEL[from.lang]}판)과 같은 그림의 한글판 카드예요. 도안은 한글판 기준이에요.
          </p>
        )}
      </header>
      <section aria-labelledby="artworks-heading" className={styles.artworks}>
        <h2 id="artworks-heading" className={styles.artworksHeading}>
          확장 아트 도안 0개
        </h2>
      </section>
    </article>
  );
}

function aliasFrom(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const m = raw?.match(/^(ja|en):([^:]+):(.+)$/);
  return m ? { lang: m[1] as "ja" | "en", setCode: m[2], number: `${m[2]} ${m[3]}` } : null;
}
