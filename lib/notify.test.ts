import { afterEach, describe, expect, it, vi } from "vitest";
import { notifyReport, reportEmail } from "./notify";

const base = {
  id: "11111111-1111-4111-8111-111111111111",
  origin: "https://example.org",
  autoHidden: false,
  report: {
    artworkId: "22222222-2222-4222-8222-222222222222",
    sourceUrl: null,
    reason: "suspected_theft" as const,
    contact: "artist@example.com",
    message: "제 도안이에요\n<script>alert(1)</script>",
  },
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("reportEmail", () => {
  it("links the admin artwork page and keeps visitor text as plain text", () => {
    const { subject, text } = reportEmail(base);
    expect(subject).toBe("[신고] 도용 의심 · 작품 지정");
    expect(text).toContain("대상: https://example.org/admin/artworks/22222222-2222-4222-8222-222222222222");
    expect(text).toContain("연락처: artist@example.com");
    expect(text).toContain("<script>alert(1)</script>");
    expect(text).toContain("신고 목록: https://example.org/admin/reports");
  });

  it("marks auto-hidden reports and uses the source URL when no artwork is named", () => {
    const { subject, text } = reportEmail({
      ...base,
      autoHidden: true,
      report: { ...base.report, artworkId: null, sourceUrl: "https://cafe.naver.com/x/1", contact: null, message: null },
    });
    expect(subject).toBe("[신고·자동 숨김] 도용 의심 · 주소만");
    expect(text).toContain("대상: https://cafe.naver.com/x/1");
    expect(text).not.toContain("연락처");
  });
});

describe("notifyReport", () => {
  it("only logs when mail is not configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubEnv("RESEND_API_KEY", "");
    await notifyReport(base);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a text email through Resend to every recipient", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("REPORT_NOTIFY_TO", "a@example.org, b@example.org");
    vi.stubEnv("REPORT_NOTIFY_FROM", "알림 <alerts@example.org>");
    await notifyReport(base);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ from: "알림 <alerts@example.org>", to: ["a@example.org", "b@example.org"] });
    expect(body.html).toBeUndefined();
  });

  it("swallows send failures so the report still succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("REPORT_NOTIFY_TO", "a@example.org");
    vi.stubEnv("REPORT_NOTIFY_FROM", "alerts@example.org");
    await expect(notifyReport(base)).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalled();
  });
});
