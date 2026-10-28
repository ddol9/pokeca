import { SearchForm } from "@/components/SearchForm";
import styles from "./page.module.css";

// design 3A: 워드마크, 제목, 큰 검색창. "최근 도안이 등록된 카드"는 작품 등록 단계에서 붙인다.
export default function Home() {
  return (
    <section className={styles.home}>
      <h1 className={styles.title}>카드 번호로 확장 아트 찾기</h1>
      <SearchForm />
    </section>
  );
}
