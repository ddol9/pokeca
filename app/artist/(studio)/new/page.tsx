import { Suspense } from "react";
import { redirect } from "next/navigation";
import { NewArtworkForm } from "@/components/admin/NewArtworkForm";
import { requireArtist } from "@/lib/artists";
import styles from "@/app/admin/admin.module.css";

export const metadata = { title: "도안 올리기 · 확장 아트 아카이브" };

export default function NewArtistArtworkPage() {
  return (
    <section className={`${styles.console} ${styles.medium}`}>
      <h1 className={styles.title}>도안 올리기</h1>
      <Suspense fallback={<p className={styles.muted}>불러오는 중…</p>}>
        <Gate />
      </Suspense>
    </section>
  );
}

// 승인된 작가만. 대기·거절이면 작가 홈에서 상태를 안내한다.
async function Gate() {
  const artist = await requireArtist();
  if (artist.status !== "approved") redirect("/artist");
  return <NewArtworkForm mode="artist" />;
}
