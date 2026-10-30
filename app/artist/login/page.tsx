import { Suspense } from "react";
import { socialLogin } from "../actions";
import styles from "@/app/admin/admin.module.css";

export const metadata = { title: "작가 로그인 · 확장 아트 아카이브" };

// 작가 로그인은 카카오·구글뿐이다. 처음이면 로그인 뒤 작가 신청 폼으로 간다.
export default function ArtistLoginPage(props: PageProps<"/artist/login">) {
  return (
    <section className={styles.narrow}>
      <h1 className={styles.title}>작가 로그인</h1>
      <p>직접 만든 확장 아트 도안을 올리고 내 작가 페이지에 모을 수 있어요. 처음이면 로그인한 뒤 작가 신청을 해 주세요.</p>
      <Suspense>
        <Failed searchParams={props.searchParams} />
      </Suspense>
      <form action={socialLogin} className={styles.form}>
        <button type="submit" name="provider" value="kakao" className={styles.kakao}>
          카카오로 계속하기
        </button>
        <button type="submit" name="provider" value="google" className={styles.google}>
          구글로 계속하기
        </button>
      </form>
      <p className={styles.muted}>로그인하면 이름(닉네임)과 이메일만 받아요. 비밀번호는 저장하지 않아요.</p>
    </section>
  );
}

async function Failed({ searchParams }: { searchParams: PageProps<"/artist/login">["searchParams"] }) {
  if (!(await searchParams).error) return null;
  return <p className={styles.error}>로그인하지 못했어요. 다시 시도해 주세요.</p>;
}
