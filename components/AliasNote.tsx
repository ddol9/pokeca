"use client";

import { useState } from "react";
import styles from "./AliasNote.module.css";

// 별칭으로 들어온 방문자에게 한 줄 안내 (design 13A). 닫을 수 있다.
export function AliasNote({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className={styles.note}>
      <p>{children}</p>
      <button type="button" className={styles.close} onClick={() => setOpen(false)}>
        닫기
      </button>
    </div>
  );
}
