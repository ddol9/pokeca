import { Suspense } from "react";
import { requireApplicant } from "@/lib/artists";
import { ApplyForm } from "../AuthForms";
import styles from "@/app/admin/admin.module.css";

export const metadata = { title: "작가 신청 · 확장 아트 아카이브" };

// 카카오·구글로 처음 로그인한 사람의 작가 신청. 어드민이 확인하면 도안을 올릴 수 있다.
export default function ArtistSignupPage() {
  return (
    <section className={styles.narrow}>
      <h1 className={styles.title}>작가 신청</h1>
      <p>어드민이 본인 확인을 마치면 바로 도안을 올릴 수 있어요.</p>
      <Suspense fallback={<p className={styles.muted}>불러오는 중…</p>}>
        <Apply />
      </Suspense>
    </section>
  );
}

async function Apply() {
  const user = await requireApplicant();
  return <ApplyForm suggestedName={user.name} />;
}
