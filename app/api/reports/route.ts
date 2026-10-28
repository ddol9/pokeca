import { after } from "next/server";
import { notifyReport } from "@/lib/notify";
import { clientIp, hashRange, parseReport, ReportError, submitReport } from "@/lib/reports";

// 신고·내림 요청 (design 14A). 성공 기준은 reports 저장이다(메일은 부가).
export async function POST(request: Request) {
  const secret = process.env.REPORT_HASH_SECRET;
  if (!secret) throw new Error("REPORT_HASH_SECRET is not set");
  try {
    const report = parseReport(await request.json());
    const { id, autoHidden } = await submitReport(report, hashRange(clientIp(request.headers), secret));
    // 메일은 응답 뒤에 보낸다. 실패해도 신고는 이미 저장됐다 (eng T7).
    after(() => notifyReport({ id, report, autoHidden, origin: new URL(request.url).origin }));
    return Response.json({ id }, { status: 201 });
  } catch (e) {
    if (e instanceof SyntaxError) return Response.json({ code: "invalid_json" }, { status: 400 });
    if (e instanceof ReportError) {
      const status = e.code === "rate_limited" ? 429 : e.code === "not_found" ? 404 : 400;
      return Response.json({ code: e.code }, { status });
    }
    throw e;
  }
}
