import type { Metadata } from "next";
import Link from "next/link";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "wanted-sans/fonts/webfonts/variable/split/WantedSansVariable.css";
import { Suspense } from "react";
import { HeaderSearch } from "@/components/HeaderSearch";
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
          {/* 카드 페이지처럼 동적 경로에서는 usePathname이 요청 시점까지 멈추므로 Suspense로 감싼다. */}
          <div className={styles.search}>
            <Suspense>
              <HeaderSearch />
            </Suspense>
          </div>
        </header>
        <main className={styles.main}>{children}</main>
        <footer className={styles.footer}>
          <p>비영리 팬 아카이브입니다. 도안의 권리는 각 아티스트에게 있습니다.</p>
          <p>
            <Link href="/artist/login">작가로 도안 올리기</Link> · <Link href="/takedown">권리자 내림 요청</Link>
          </p>
        </footer>
      </body>
    </html>
  );
}
