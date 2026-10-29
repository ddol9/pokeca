import "server-only";
import sharp from "sharp";
import { readFile, storeGenerated, type StoredFile } from "@/lib/storage";

// 원본에서 미리보기(kind = thumbnail)를 만든다. 카드 페이지 타일과 크게 보기가 같은 파일을 쓴다.
// 투명 영역(카드 자리)을 살리려고 webp로 만든다. PDF는 서버에서 그리지 않으므로 어드민이 직접 올린다.

export const PREVIEW_MAX_PX = 1600;

export class PreviewError extends Error {}

export async function renderPreview(input: Uint8Array): Promise<Uint8Array> {
  try {
    const out = await sharp(input, { limitInputPixels: 300_000_000 })
      .rotate()
      .resize({ width: PREVIEW_MAX_PX, height: PREVIEW_MAX_PX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    return new Uint8Array(out);
  } catch {
    throw new PreviewError("preview_failed");
  }
}

export async function makePreview(artworkId: string, original: StoredFile): Promise<StoredFile> {
  if (original.mimeType === "application/pdf") throw new PreviewError("pdf_needs_thumbnail");
  return storeGenerated(artworkId, "thumbnail", await renderPreview(await readFile(original.path)), "image/webp");
}
