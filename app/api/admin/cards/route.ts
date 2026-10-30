import { adminRoute } from "@/lib/admin-route";
import { cardCandidates } from "@/lib/cards";

// 작품 등록 폼의 카드 찾기. 공개 검색과 같은 규칙(번호·이름)을 쓴다.
export const GET = adminRoute(async (request) => {
  return Response.json(await cardCandidates(new URL(request.url).searchParams.get("q") ?? ""));
});
