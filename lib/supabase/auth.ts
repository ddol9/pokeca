import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";

// 어드민 로그인 세션 전용 클라이언트(공개 키). 데이터는 이 클라이언트로 읽지 않는다(RLS 기본 거부).
export async function authClient() {
  const store = await cookies();
  // 쿠키가 채워진 미리 렌더(런타임 prefetch)에서도 세션 확인은 요청 때만 한다. getUser가 토큰 만료를
  // Date.now()로 재서 그대로 두면 Next가 "unstable value Date.now()" 오류를 낸다(어드민·작가 화면).
  await connection();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. 세션 갱신은 서버 함수·라우트에서 일어난다.
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {}
        },
      },
    },
  );
}
