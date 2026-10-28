import "server-only";
import { currentAdmin, type Admin } from "@/lib/admin";
import { ArtworkError } from "@/lib/artworks";
import { StorageInputError } from "@/lib/storage";

// 어드민 API 공통 처리: 로그인·허용 목록 확인, 입력 오류를 400 {code}로 바꾼다.
export function adminRoute<C>(handler: (request: Request, ctx: C, admin: Admin) => Promise<Response>) {
  return async (request: Request, ctx: C): Promise<Response> => {
    const admin = await currentAdmin();
    if (!admin) return Response.json({ code: "unauthorized" }, { status: 401 });
    try {
      return await handler(request, ctx, admin);
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
