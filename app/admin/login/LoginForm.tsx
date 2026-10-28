"use client";

import { useActionState } from "react";
import { login } from "../actions";
import styles from "../admin.module.css";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className={styles.form}>
      <label className={styles.field}>
        <span>이메일</span>
        <input name="email" type="email" required autoComplete="username" className={styles.input} />
      </label>
      <label className={styles.field}>
        <span>비밀번호</span>
        <input name="password" type="password" required autoComplete="current-password" className={styles.input} />
      </label>
      <div role="status">{state?.error && <p className={styles.error}>{state.error}</p>}</div>
      <button type="submit" className={styles.primary} disabled={pending}>
        {pending ? "확인 중…" : "로그인"}
      </button>
    </form>
  );
}
