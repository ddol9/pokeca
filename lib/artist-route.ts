import "server-only";
import { currentArtist, type Artist } from "@/lib/artists";
import { ArtworkError } from "@/lib/artworks";
import { StorageInputError } from "@/lib/storage";

// 작가 API 공통 처리: 로그인한 승인 작가만. 입력 오류는 400 {code} (adminRoute와 같은 모양).
export function artistRoute<C>(handler: (request: Request, ctx: C, artist: Artist) => Promise<Response>) {
  return async (request: Request, ctx: C): Promise<Response> => {
    const artist = await currentArtist();
    if (!artist) return Response.json({ code: "unauthorized" }, { status: 401 });
    if (artist.status !== "approved") return Response.json({ code: "artist_not_approved" }, { status: 403 });
    try {
      return await handler(request, ctx, artist);
    } catch (e) {
      if (e instanceof ArtworkError) {
        return Response.json({ code: e.code }, { status: e.code === "not_found" ? 404 : 400 });
      }
      if (e instanceof StorageInputError || e instanceof SyntaxError) {
        return Response.json({ code: e instanceof SyntaxError ? "invalid_json" : e.message }, { status: 400 });
      }
      throw e;
    }
  };
}
