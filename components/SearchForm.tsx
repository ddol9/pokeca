import Form from "next/form";
import { SearchButton } from "./SearchButton";
import styles from "./SearchForm.module.css";

type Size = "large" | "compact" | "header";

// 검색은 GET 폼이라 자바스크립트 없이도 동작한다. next/form은 그 위에 클라이언트 이동과 진행 표시를 더한다.
// header는 머리글용이라 라벨을 숨기고, 예시는 넓은 화면에서 placeholder로, 모바일에서 펼쳤을 때 입력창 아래에 보인다.
export function SearchForm({ defaultValue = "", size = "large" }: { defaultValue?: string; size?: Size }) {
  const isHeader = size === "header";
  return (
    // 검색 화면처럼 본문 검색과 함께 나올 때 두 search 랜드마크를 구분하도록 이름을 붙인다.
    <Form role="search" action="/search" className={styles[size]} aria-label={isHeader ? "머리글 카드 검색" : undefined}>
      <label htmlFor={`q-${size}`} className={isHeader ? "visually-hidden" : styles.label}>
        {isHeader ? "카드 번호 또는 이름 검색" : "카드 번호 또는 이름"}
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
          placeholder={isHeader ? "sv2a 201/165, 리자몽" : undefined}
          aria-describedby={`q-${size}-hint`}
        />
        <SearchButton className={styles.submit} />
      </div>
      <p id={`q-${size}-hint`} className={isHeader ? styles.headerHint : styles.hint}>
        예: sv2a 201/165, 리자몽
      </p>
    </Form>
  );
}
