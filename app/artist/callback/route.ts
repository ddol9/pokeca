import { NextResponse } from "next/server";
import { authClient } from "@/lib/supabase/auth";

// 카카오·구글 로그인에서 돌아오는 곳. 코드를 세션으로 바꾸고 작가 홈으로 보낸다.
// 작가 신청 전이면 작가 홈(requireArtist)이 신청 폼으로 보낸다.
export async function GET(request: Request) {
  const url = new URL(request.url);
  // 세션 쿠키는 브라우저가 연 주소(Host)에 붙는다. request.url은 dev 서버에서 localhost로 바뀌어 있을 수 있어
  // socialLogin과 같이 Host 헤더로 돌려보낸다(127.0.0.1로 열었는데 localhost로 가면 쿠키가 사라진다).
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const origin = `${request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")}://${host}`;
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await (await authClient()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/artist", origin));
  }
  return NextResponse.redirect(new URL("/artist/login?error=1", origin));
}
