import { Suspense } from "react";
import Link from "next/link";
import { reviewArtist } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/admin";
import { listArtists, type ArtistStatus } from "@/lib/artists";
import styles from "../../admin.module.css";

export const metadata = { title: "작가 · 어드민" };

const PROVIDER_LABEL = { kakao: "카카오", google: "구글" } as const;
const STATUS_LABEL: Record<ArtistStatus, string> = { pending: "승인 대기", approved: "승인됨", rejected: "거절됨" };

// 작가 가입 신청 → 본인 확인(작품을 올리는 곳 링크) → 승인하면 바로 도안을 올릴 수 있다.
export default function ArtistsPage() {
  return (
    <section className={`${styles.console} ${styles.wide}`}>
      <h1 className={styles.title}>작가</h1>
      <Suspense fallback={<p className={styles.muted}>불러오는 중…</p>}>
        <Artists />
      </Suspense>
    </section>
  );
}

async function Artists() {
  await requireAdmin();
  const artists = await listArtists();
  const pending = artists.filter((a) => a.status === "pending").length;
  return (
    <>
      <p>
        {artists.length}명 · 승인 대기 {pending}명
      </p>
      {artists.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">작가</th>
                <th scope="col">로그인</th>
                <th scope="col">작품을 올리는 곳</th>
                <th scope="col">신청일</th>
                <th scope="col">작품</th>
                <th scope="col">상태</th>
                <th scope="col">처리</th>
              </tr>
            </thead>
            <tbody>
              {artists.map((a) => (
                <tr key={a.userId}>
                  <td>
                    <strong>@{a.displayName}</strong>
                    <br />
                    {a.status === "approved" ? (
                      <Link href={`/artists/${a.handle}`}>/artists/{a.handle}</Link>
                    ) : (
                      <span className={styles.muted}>/artists/{a.handle}</span>
                    )}
                    {a.intro && <p className={styles.muted}>{a.intro}</p>}
                  </td>
                  <td>
                    {PROVIDER_LABEL[a.provider]}
                    <br />
                    <span className={styles.muted}>{a.email ?? "이메일 없음"}</span>
                  </td>
                  <td>
                    {a.linkUrl ? (
                      <a href={a.linkUrl} target="_blank" rel="noopener noreferrer">
                        열기 ↗<span className="visually-hidden">(새 탭)</span>
                      </a>
                    ) : (
                      <span className={styles.muted}>없음</span>
                    )}
                  </td>
                  <td>{new Date(a.createdAt).toLocaleDateString("ko-KR")}</td>
                  <td>{a.artworkCount}</td>
                  <td>{a.status === "pending" ? <span className={styles.flag}>{STATUS_LABEL[a.status]}</span> : STATUS_LABEL[a.status]}</td>
                  <td>
                    <form action={reviewArtist} className={styles.row}>
                      <input type="hidden" name="userId" value={a.userId} />
                      {a.status !== "approved" && (
                        <button type="submit" name="status" value="approved" className={styles.primary}>
                          승인
                        </button>
                      )}
                      {a.status !== "rejected" && (
                        <button type="submit" name="status" value="rejected" className={styles.secondary}>
                          {a.status === "approved" ? "업로드 막기" : "거절"}
                        </button>
                      )}
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
