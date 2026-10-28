import { after } from "next/server";
import { isFormat } from "@/lib/formats";
import { cardExists, createRequest, recordDemandIfEmpty, requestState } from "@/lib/requests";
import { visitorId } from "@/lib/visitor";

// 카드 상세의 요청 상태는 방문자별이라 페이지와 따로 불러온다 (eng R8).
export async function GET(_request: Request, ctx: RouteContext<"/api/cards/[id]/requests">) {
  const { id } = await ctx.params;
  if (!(await cardExists(id))) return Response.json({ code: "not_found" }, { status: 404 });
  const visitor = await visitorId();
  after(() => recordDemandIfEmpty(id, visitor).catch((e) => console.error("card_demand", e)));
  return Response.json(await requestState(id, visitor), { headers: { "Cache-Control": "private, no-store" } });
}

// 찾기 요청 (design 5A, eng E5). 같은 방문자의 재요청은 조용히 성공으로 처리한다.
export async function POST(request: Request, ctx: RouteContext<"/api/cards/[id]/requests">) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  if (!isFormat(body?.format)) return Response.json({ code: "invalid_format" }, { status: 400 });
  if (!(await cardExists(id))) return Response.json({ code: "not_found" }, { status: 404 });
  const visitor = await visitorId();
  if (!visitor) return Response.json({ code: "no_visitor" }, { status: 400 });
  await createRequest(id, body.format, visitor);
  return Response.json(await requestState(id, visitor));
}
