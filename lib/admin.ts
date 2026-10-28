import "server-only";
import { redirect } from "next/navigation";
import { authClient } from "@/lib/supabase/auth";
import { db } from "@/lib/supabase/server";
import { ArtworkError, setConsent, setStatus, type ConsentLevel } from "@/lib/artworks";

// 어드민 = Supabase Auth 로그인 + admins 허용 목록 (설계 "관리자와 업로드 보안").
export type Admin = { userId: string; email: string };

export async function currentAdmin(): Promise<Admin | null> {
  const {
    data: { user },
  } = await (await authClient()).auth.getUser();
  if (!user) return null;
  const { data, error } = await db().from("admins").select("user_id, email").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  return data ? { userId: data.user_id, email: data.email } : null;
}

// 어드민 화면과 server action의 첫 줄. 허용 목록에 없으면 로그인으로 보낸다.
export async function requireAdmin(): Promise<Admin> {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login?denied=1");
  return admin;
}

// 파괴적 행동(철회, 허락 하향)은 화면 확인과 별개로 서버에서도 확인한다 (eng E1).
// confirm은 그 작품 정본 카드의 "세트 번호" 문자열이어야 한다. 예: "sv2a 201/165"
export async function expectedConfirm(artworkId: string): Promise<string | null> {
  const { data, error } = await db()
    .from("artworks")
    .select("cards(set_code, collector_number)")
    .eq("id", artworkId)
    .maybeSingle<{ cards: { set_code: string; collector_number: string } }>();
  if (error) throw error;
  return data ? `${data.cards.set_code} ${data.cards.collector_number}` : null;
}

export type AdminArtworkAction =
  | { action: "hide" | "restore"; reason?: string }
  | { action: "withdraw"; reason?: string; confirm?: string }
  | {
      action: "consent";
      consentLevel: ConsentLevel;
      thumbnailOk: boolean;
      reason?: string;
      evidenceUploadId?: string; // 허락 근거 업로드 ID (POST /api/admin/uploads, kind "evidence")
      confirm?: string;
    };

export async function applyAdminAction(id: string, input: AdminArtworkAction, admin: Admin) {
  const actor = admin.email;
  if (!input || typeof input !== "object") throw new ArtworkError("invalid_action");
  switch (input.action) {
    case "hide":
      return setStatus(id, "hidden", { reason: input.reason, actor });
    case "restore":
      return setStatus(id, "active", { reason: input.reason, actor });
    case "withdraw":
      await requireConfirm(id, input.confirm);
      return setStatus(id, "withdrawn", { reason: input.reason, actor });
    case "consent": {
      // "false" 같은 문자열이 참으로 읽혀 하향 확인을 건너뛰지 않게 정확한 값만 받는다.
      if (typeof input.thumbnailOk !== "boolean") throw new ArtworkError("invalid_consent");
      if (input.consentLevel !== "link_only" && input.consentLevel !== "hosted") throw new ArtworkError("invalid_consent");
      const { data, error } = await db()
        .from("artworks")
        .select("consent_level, thumbnail_ok")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new ArtworkError("not_found");
      const downgrade =
        (data.consent_level === "hosted" && input.consentLevel === "link_only") ||
        (data.thumbnail_ok && !input.thumbnailOk);
      if (downgrade) await requireConfirm(id, input.confirm);
      return setConsent(
        id,
        { consentLevel: input.consentLevel, thumbnailOk: input.thumbnailOk },
        {
          reason: input.reason,
          actor,
          evidenceUploadId: input.evidenceUploadId ? String(input.evidenceUploadId) : undefined,
        },
      );
    }
    default:
      throw new ArtworkError("invalid_action");
  }
}

async function requireConfirm(id: string, confirm: string | undefined) {
  const expected = await expectedConfirm(id);
  if (!expected) throw new ArtworkError("not_found");
  const normalize = (s: string) => s.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  if (!confirm || normalize(confirm) !== normalize(expected)) throw new ArtworkError("confirm_mismatch");
}
