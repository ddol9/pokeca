import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 모든 DB·저장소 접근은 이 클라이언트를 거친다(eng D6).
// 테이블은 RLS 기본 거부라 공개 키로는 아무것도 읽을 수 없고, 서버만 secret 키로 접근한다.
let client: SupabaseClient | undefined;

export function db(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set");
    }
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
