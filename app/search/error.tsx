"use client";

import { useEffect } from "react";
import { SearchForm } from "@/components/SearchForm";
import styles from "./page.module.css";

// 검색 오류 (design 6A): 검색창은 그대로 두고 다시 시도할 수 있게 한다.
export default function SearchError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className={styles.page}>
      <h1 className="visually-hidden">카드 검색</h1>
      <SearchForm size="compact" />
      <div className={styles.miss} role="alert">
        <h2 className={styles.missTitle}>검색이 잠시 안 돼요</h2>
        <p>
          <button type="button" className={styles.retry} onClick={() => retry()}>
            다시 시도
          </button>
        </p>
      </div>
    </section>
  );
}
