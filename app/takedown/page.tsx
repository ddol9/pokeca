import { ReportForm } from "@/components/ReportForm";
import styles from "./page.module.css";

export const metadata = { title: "권리자 내림 요청 · 확장 아트 아카이브" };

// 푸터 "권리자 내림 요청" (design 14A). 작품을 고르지 않고 원본 URL로 신고한다.
// 어드민이 URL로 작품을 찾아 연결하거나 "대상 없음"으로 닫는다 (eng E7).
export default function TakedownPage() {
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>권리자 내림 요청</h1>
      <p className={styles.lead}>
        내 그림이 허락 없이 올라와 있거나 더 이상 공유를 원하지 않으면 알려 주세요. 확인한 뒤 48시간 안에 내리고, 보관
        중인 파일은 삭제해요.
      </p>
      <ReportForm />
    </section>
  );
}
