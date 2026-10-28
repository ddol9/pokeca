import styles from "./SearchForm.module.css";

// 검색은 GET 폼이라 자바스크립트 없이도 동작한다.
export function SearchForm({ defaultValue = "", size = "large" }: { defaultValue?: string; size?: "large" | "compact" }) {
  return (
    <form role="search" action="/search" className={styles[size]}>
      <label htmlFor={`q-${size}`} className={styles.label}>
        카드 번호 또는 이름
      </label>
      <div className={styles.row}>
        <input
          id={`q-${size}`}
          name="q"
          type="search"
          defaultValue={defaultValue}
          className={styles.input}
          autoComplete="off"
          enterKeyHint="search"
          aria-describedby={`q-${size}-hint`}
        />
        <button type="submit" className={styles.submit}>
          찾기
        </button>
      </div>
      <p id={`q-${size}-hint`} className={styles.hint}>
        예: sv2a 201/165, 리자몽
      </p>
    </form>
  );
}
