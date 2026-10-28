import { cookies } from "next/headers";

// 익명 방문자 ID (설계 "측정"): 로그인 없이 고유 방문자·재방문·중복 요청을 센다.
// proxy.ts가 첫 요청에서 발급하므로 서버 컴포넌트에서는 항상 읽을 수 있다.
export const VISITOR_COOKIE = "vid";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isVisitorId(value: string | undefined): value is string {
  return !!value && UUID.test(value);
}

export async function visitorId(): Promise<string | null> {
  const value = (await cookies()).get(VISITOR_COOKIE)?.value;
  return isVisitorId(value) ? value : null;
}
