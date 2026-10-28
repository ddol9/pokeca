import { NextResponse, type NextRequest } from "next/server";
import { isVisitorId, VISITOR_COOKIE } from "@/lib/visitor";

// 방문자 ID 쿠키가 없으면 발급한다. 같은 요청의 서버 컴포넌트도 읽을 수 있게 요청 쿠키에도 넣는다.
export function proxy(request: NextRequest) {
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

export const config = {
  // 정적 파일과 어드민은 측정하지 않는다.
  matcher: ["/((?!_next/|admin|api/admin|favicon.ico|.*\\.(?:svg|png|jpg|woff2?)$).*)"],
};
