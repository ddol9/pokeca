import styles from "./page.module.css";

// 검색 동작은 다음 단계(lib/search)에서 붙인다. 지금은 홈 위계(design 3A)만 잡는다.
export default function Home() {
  return (
    <section className={styles.home}>
      <h1 className={styles.title}>카드 번호로 확장 아트 찾기</h1>
      <form role="search" action="/search" className={styles.form}>
        <label htmlFor="q" className={styles.label}>
          카드 번호 또는 이름
        </label>
        <input id="q" name="q" type="search" className={styles.input} autoComplete="off" />
        <p className={styles.hint}>예: sv2a 201/165, 리자몽</p>
      </form>
    </section>
  );
}
