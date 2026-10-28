import { cleanup } from "@/lib/cleanup";

// Vercel Cron은 Authorization: Bearer <CRON_SECRET>을 붙여 호출한다.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response(null, { status: 401 });
  }
  const report = await cleanup();
  return Response.json(report, { headers: { "Cache-Control": "no-store" } });
}
