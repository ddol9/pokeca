import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isVisitorId, VISITOR_COOKIE } from "@/lib/visitor";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) return adminSession(request);
  return visitor(request);
}

// 방문자 ID 쿠키가 없으면 발급한다. 같은 요청의 서버 컴포넌트도 읽을 수 있게 요청 쿠키에도 넣는다.
function visitor(request: NextRequest) {
  if (isVisitorId(request.cookies.get(VISITOR_COOKIE)?.value)) {
    return NextResponse.next();
  }

  const id = crypto.randomUUID();
  request.cookies.set(VISITOR_COOKIE, id);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(VISITOR_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return response;
}

// 어드민 로그인 세션 갱신. 서버 컴포넌트는 쿠키를 쓸 수 없어서 만료된 토큰을 여기서 새로 받아 둔다.
// 로그인하지 않은 화면 요청은 로그인으로 보낸다. 허용 목록 확인은 각 화면·API의 requireAdmin()이 한다.
async function adminSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (!user && pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const login = request.nextUrl.clone();
    login.pathname = "/admin/login";
    login.search = "";
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  // 정적 파일은 건너뛴다.
  matcher: ["/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|woff2?)$).*)"],
};
