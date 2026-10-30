import { Suspense } from "react";
import Link from "next/link";
import { listMyArtworks, requireArtist, type Artist } from "@/lib/artists";
import { FORMAT_INFO, type Format } from "@/lib/formats";
import { WithdrawMine } from "./WithdrawMine";
import styles from "@/app/admin/admin.module.css";

export const metadata = { title: "내 도안 · 확장 아트 아카이브" };

// 작가 홈: 승인 상태 → (승인됨) 내 도안 목록 + 내리기.
export default function StudioPage(props: PageProps<"/artist">) {
  return (
    <section className={`${styles.console} ${styles.wide}`}>
      <Suspense fallback={<p className={styles.muted}>불러오는 중…</p>}>
        <Studio searchParams={props.searchParams} />
      </Suspense>
    </section>
  );
}

const STATUS_LABEL = { active: "공개", hidden: "숨김(어드민 확인 중)", withdrawn: "내림" } as const;

async function Studio({ searchParams }: { searchParams: PageProps<"/artist">["searchParams"] }) {
  const artist = await requireArtist();
  const { uploaded } = await searchParams;
  return (
    <>
      <h1 className={styles.title}>@{artist.displayName}</h1>
      <Status artist={artist} />
      {artist.status === "approved" && (
        <>
          {uploaded && (
            <p role="status" className={styles.ok}>
              도안을 올렸어요. 카드 페이지와 작가 페이지에 공개됐어요.
            </p>
          )}
          <MyArtworks artist={artist} />
        </>
      )}
    </>
  );
}

function Status({ artist }: { artist: Artist }) {
  if (artist.status === "pending") {
    return (
      <div className={styles.section}>
        <p>
          <strong>작가 신청을 받았어요.</strong> 어드민이 본인 확인을 마치면 도안을 올릴 수 있어요.
        </p>
        <p className={styles.muted}>
          확인이 늦어지면 작품을 올리는 카페·SNS 주소를 어드민에게 알려 주세요. 신청한 작가 페이지 주소: /artists/
          {artist.handle}
        </p>
      </div>
    );
  }
  if (artist.status === "rejected") {
    return (
      <div className={styles.section}>
        <p>
          <strong>지금은 도안을 올릴 수 없어요.</strong> 어드민이 작가 확인을 마치지 못했어요. 문의는 사이트 푸터의
          연락처로 보내 주세요.
        </p>
      </div>
    );
  }
  return (
    <p>
      <Link href={`/artists/${artist.handle}`}>내 작가 페이지 보기</Link> ·{" "}
      <Link href="/artist/new">도안 올리기</Link>
    </p>
  );
}

async function MyArtworks({ artist }: { artist: Artist }) {
  const artworks = await listMyArtworks(artist.userId);
  return (
    <section aria-labelledby="mine-heading" className={styles.section}>
      <h2 id="mine-heading" className={styles.subtitle}>
        올린 도안 {artworks.length}개
      </h2>
      {artworks.length === 0 ? (
        <p className={styles.muted}>
          아직 올린 도안이 없어요. <Link href="/artist/new">첫 도안 올리기</Link>
        </p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">카드</th>
                <th scope="col">규격</th>
                <th scope="col">상태</th>
                <th scope="col">올린 날</th>
                <th scope="col">내리기</th>
              </tr>
            </thead>
            <tbody>
              {artworks.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link href={a.card.path} className={styles.number}>
                      {a.card.label}
                    </Link>{" "}
                    {a.card.name}
                  </td>
                  <td>{FORMAT_INFO[a.format as Format]?.label ?? a.format}</td>
                  <td>{STATUS_LABEL[a.status]}</td>
                  <td>{new Date(a.createdAt).toLocaleDateString("ko-KR")}</td>
                  <td>
                    <WithdrawMine id={a.id} cardLabel={a.card.label} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
