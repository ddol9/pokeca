import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

const root = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
      // server-only는 Next 번들러 밖에서 import 오류를 내므로 테스트에서는 빈 모듈로 바꾼다.
      "server-only": path.join(root, "tests/server-only-stub.ts"),
    },
  },
  test: {
    // .env.local의 로컬 Supabase 값을 쓴다. CI는 같은 이름의 환경 변수를 직접 넣는다.
    env: loadEnv("test", root, ""),
    include: ["lib/**/*.test.ts", "tests/integration/**/*.test.ts"],
    fileParallelism: false,
  },
});
