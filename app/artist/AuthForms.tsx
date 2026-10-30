"use client";

import { useActionState } from "react";
import { apply } from "./actions";
import styles from "@/app/admin/admin.module.css";

// 작가 신청 폼. 로그인(카카오·구글)을 마친 사람만 본다.
export function ApplyForm({ suggestedName }: { suggestedName: string | null }) {
  const [state, action, pending] = useActionState(apply, null);
  return (
    <form action={action} className={styles.form}>
      <label className={styles.field}>
        <span>작가 이름</span>
        <span>도안 옆에 @이름으로 보여요. 카페·SNS에서 쓰는 닉네임을 넣어 주세요.</span>
        <input name="displayName" required maxLength={40} defaultValue={suggestedName ?? ""} className={styles.input} />
      </label>
      <label className={styles.field}>
        <span>작가 페이지 주소</span>
        <span>영문 소문자·숫자·밑줄(_) 2~30자. 예: /artists/pikachu_art</span>
        <input
          name="handle"
          required
          pattern="[a-z0-9_]{2,30}"
          maxLength={30}
          autoCapitalize="off"
          autoComplete="off"
          className={styles.input}
        />
      </label>
      <label className={styles.field}>
        <span>소개 (선택)</span>
        <textarea name="intro" maxLength={300} rows={3} className={styles.input} />
      </label>
      <label className={styles.field}>
        <span>작품을 올리는 곳 (선택)</span>
        <span>카페 글 목록이나 SNS 주소. 어드민이 본인 확인에 써요.</span>
        <input name="linkUrl" type="url" placeholder="https://" className={styles.input} />
      </label>
      <div role="status">{state?.error && <p className={styles.error}>{state.error}</p>}</div>
      <button type="submit" className={styles.primary} disabled={pending}>
        {pending ? "신청하는 중…" : "작가 신청"}
      </button>
    </form>
  );
}
