import { SearchForm } from "@/components/SearchForm";

// design 6A: 없는 카드는 홈 검색으로 안내한다.
export default function NotFound() {
  return (
    <section style={{ display: "grid", gap: "calc(var(--space) * 3)", maxWidth: 720 }}>
      <h1>이 카드는 아직 목록에 없어요</h1>
      <SearchForm size="compact" />
    </section>
  );
}
