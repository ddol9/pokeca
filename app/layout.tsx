import type { Metadata } from "next";
import Link from "next/link";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "wanted-sans/fonts/webfonts/variable/split/WantedSansVariable.css";
import "./globals.css";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: "확장 아트 아카이브",
  description: "카드 번호로 포켓몬 카드 확장 아트 도안을 찾는 비영리 아카이브",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>
        <header className={styles.header}>
          <Link href="/" className={styles.wordmark}>
            확장 아트 아카이브
          </Link>
        </header>
        <main className={styles.main}>{children}</main>
        <footer className={styles.footer}>
          <p>비영리 팬 아카이브입니다. 도안의 권리는 각 아티스트에게 있습니다.</p>
          <p>
            <Link href="/takedown">권리자 내림 요청</Link>
          </p>
        </footer>
      </body>
    </html>
  );
}
