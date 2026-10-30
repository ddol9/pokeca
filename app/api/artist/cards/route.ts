import { artistRoute } from "@/lib/artist-route";
import { cardCandidates } from "@/lib/cards";

// 도안 올리기 폼의 카드 찾기 (어드민 등록 폼과 같은 결과).
export const GET = artistRoute(async (request) => {
  return Response.json(await cardCandidates(new URL(request.url).searchParams.get("q") ?? ""));
});
