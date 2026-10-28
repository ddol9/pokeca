import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// 어드민 로그인 세션 전용 클라이언트(공개 키). 데이터는 이 클라이언트로 읽지 않는다(RLS 기본 거부).
export async function authClient() {
  const store = await cookies();
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
