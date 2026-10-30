import { artistRoute } from "@/lib/artist-route";
import { createUpload } from "@/lib/storage";

// 작가 업로드 1단계: 서명 업로드 URL. 원본·미리보기만(허락 근거는 어드민 전용).
export const POST = artistRoute(async (request) => {
  const body = await request.json();
  if (body.kind !== "original" && body.kind !== "thumbnail") {
    return Response.json({ code: "invalid_kind" }, { status: 400 });
  }
  return Response.json(
    await createUpload({ kind: body.kind, mimeType: body.mimeType, sizeBytes: Number(body.sizeBytes) }),
  );
});
