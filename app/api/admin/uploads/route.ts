import { adminRoute } from "@/lib/admin-route";
import { createUpload } from "@/lib/storage";

// 1단계: 서명 업로드 URL 발급. 브라우저가 Supabase Storage에 직접 올린다(Vercel 4.5 MB 본문 한도 회피).
export const POST = adminRoute(async (request) => {
  const body = await request.json();
  return Response.json(
    await createUpload({ kind: body.kind, mimeType: body.mimeType, sizeBytes: Number(body.sizeBytes) }),
  );
});
