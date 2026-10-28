import { describe, expect, it } from "vitest";
import { hashRange, ipRange, parseReport, ReportError } from "./reports";

describe("ipRange", () => {
  it("cuts IPv4 to /24 and IPv6 to /48", () => {
    expect(ipRange("203.0.113.77")).toBe("203.0.113.0/24");
    expect(ipRange("::ffff:203.0.113.77")).toBe("203.0.113.0/24");
    expect(ipRange("2001:db8:abcd:12::1")).toBe("2001:db8:abcd::/48");
    expect(ipRange("2001:db8::1")).toBe("2001:db8:0::/48");
  });

  it("hashes addresses in the same range to the same value", () => {
    expect(hashRange("203.0.113.1", "s")).toBe(hashRange("203.0.113.200", "s"));
    expect(hashRange("203.0.113.1", "s")).not.toBe(hashRange("203.0.114.1", "s"));
    expect(hashRange("203.0.113.1", "s")).not.toBe(hashRange("203.0.113.1", "other"));
  });
});

describe("parseReport", () => {
  const code = (fn: () => unknown) => {
    try {
      fn();
    } catch (e) {
      return e instanceof ReportError ? e.code : "other";
    }
    return null;
  };

  it("needs a reason and an artwork or a source URL", () => {
    expect(code(() => parseReport({ reason: "nope", sourceUrl: "https://x.y" }))).toBe("invalid_reason");
    expect(code(() => parseReport({ reason: "other" }))).toBe("target_required");
    expect(code(() => parseReport({ reason: "other", sourceUrl: "javascript:alert(1)" }))).toBe("invalid_source_url");
    expect(parseReport({ reason: "rights_holder", sourceUrl: " https://cafe.naver.com/a/1 ", contact: "" })).toEqual({
      artworkId: null,
      sourceUrl: "https://cafe.naver.com/a/1",
      reason: "rights_holder",
      contact: null,
      message: null,
    });
  });
});
