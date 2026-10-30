import Link from "next/link";
import { logout } from "../actions";
import styles from "@/app/admin/admin.module.css";

// 작가 화면 공통. 접근 확인은 각 화면의 requireArtist()가 한다.
export default function StudioLayout({ children }: LayoutProps<"/artist">) {
  return (
    <div className={styles.console}>
      <nav aria-label="작가" className={styles.nav}>
        <Link href="/artist">내 도안</Link>
        <Link href="/artist/new">도안 올리기</Link>
        <form action={logout} className={styles.logout}>
          <button type="submit" className={styles.linkButton}>
            로그아웃
          </button>
        </form>
      </nav>
      {children}
    </div>
  );
}
