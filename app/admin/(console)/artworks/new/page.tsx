import { Suspense } from "react";
import { NewArtworkForm } from "@/components/admin/NewArtworkForm";
import { requireAdmin } from "@/lib/admin";
import styles from "../../../admin.module.css";

export const metadata = { title: "작품 등록 · 어드민" };

export default function NewArtworkPage() {
  return (
    <section className={`${styles.console} ${styles.medium}`}>
      <h1 className={styles.title}>작품 등록</h1>
      <Suspense fallback={<p className={styles.muted}>불러오는 중…</p>}>
        <Guarded />
      </Suspense>
    </section>
  );
}

async function Guarded() {
  await requireAdmin();
  return <NewArtworkForm />;
}
