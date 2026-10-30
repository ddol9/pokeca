"use client";

import { useActionState, useRef, useState } from "react";
import { withdraw } from "../actions";
import styles from "@/app/admin/admin.module.css";

// 내 도안 내리기. 파일이 지워져 되돌릴 수 없으므로 카드 번호를 그대로 입력해야 버튼이 켜진다(어드민 철회와 같은 규칙).
export function WithdrawMine({ id, cardLabel }: { id: string; cardLabel: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [state, action, pending] = useActionState(withdraw, null);
  const matches = typed.trim().replace(/\s+/g, " ").toLowerCase() === cardLabel.toLowerCase();
  return (
    <>
      <button type="button" className={styles.secondary} onClick={() => dialog.current?.showModal()}>
        내리기
      </button>
      <dialog ref={dialog} className={styles.dialog} aria-labelledby={`withdraw-${id}`}>
        <form action={action} className={styles.form}>
          <h2 id={`withdraw-${id}`} className={styles.subtitle}>
            {cardLabel} 도안 내리기
          </h2>
          <p>파일이 삭제되며 되돌릴 수 없어요. 다시 공개하려면 새로 올려야 해요.</p>
          <input type="hidden" name="id" value={id} />
          <label className={styles.field}>
            <span>확인을 위해 카드 번호 {cardLabel}를 입력하세요</span>
            <input
              name="confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className={styles.input}
            />
          </label>
          <div role="status">{state?.error && <p className={styles.error}>{state.error}</p>}</div>
          <div className={styles.row}>
            <button type="submit" className={styles.danger} disabled={!matches || pending}>
              {pending ? "내리는 중…" : "내리기"}
            </button>
            <button type="button" className={styles.secondary} onClick={() => dialog.current?.close()}>
              취소
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
