import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright가 127.0.0.1로 개발 서버에 붙는다.
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
