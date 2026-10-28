import { adminRoute } from "@/lib/admin-route";
import { searchCards } from "@/lib/cards";

// 작품 등록 폼의 카드 찾기. 공개 검색과 같은 규칙(번호·이름)을 쓴다.
export const GET = adminRoute(async (request) => {
  const q = new URL(request.url).searchParams.get("q")?.slice(0, 100) ?? "";
  const { hits } = await searchCards(q);
  return Response.json(
    hits.map((h) => ({ cardId: h.cardId, label: `${h.setCode} ${h.collectorNumber}`, name: h.nameKo, setName: h.setName })),
  );
});
