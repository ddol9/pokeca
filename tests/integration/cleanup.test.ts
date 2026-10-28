import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createArtwork, setStatus } from "@/lib/artworks";
import { cleanup } from "@/lib/cleanup";
import { db } from "@/lib/supabase/server";
import { cardId, PDF, PNG, resetArtworks, sql, storedPaths, uploadAsBrowser } from "../helpers/fixtures";

afterAll(() => sql.end());
beforeEach(resetArtworks);

const DAY = 24 * 60 * 60 * 1000;
const later = () => new Date(Date.now() + DAY + 60_000);

async function hostedArtwork() {
  const id = crypto.randomUUID();
  const original = await uploadAsBrowser("original", PDF, "application/pdf");
  const thumbnail = await uploadAsBrowser("thumbnail", PNG, "image/png");
  await createArtwork(
    {
      id, cardId: await cardId(), artistName: "정리", format: "psa", sourceUrl: null, sourceVisibility: null,
      consentLevel: "hosted", thumbnailOk: true, printSizeVerified: false, evidencePath: null,
    },
    { original, thumbnail },
    "test",
  );
  return id;
}

describe("cleanup", () => {
  it("keeps fresh pending uploads and removes ones older than 24 hours", async () => {
    await uploadAsBrowser("original", PDF, "application/pdf");
    expect(await cleanup()).toMatchObject({ pending: 0 });
    expect(await storedPaths()).toHaveLength(1);

    expect(await cleanup(later())).toMatchObject({ pending: 1 });
    expect(await storedPaths()).toEqual([]);
  });

  it("removes files moved into artworks/ whose row was never created", async () => {
    const orphan = `artworks/${crypto.randomUUID()}/original-x`;
    await db().storage.from("artworks").upload(orphan, PNG, { contentType: "image/png" });
    const id = await hostedArtwork();

    expect(await cleanup()).toMatchObject({ orphaned: 0 });
    expect(await cleanup(later())).toMatchObject({ orphaned: 1 });
    expect((await storedPaths()).every((p) => p.startsWith(`artworks/${id}/`))).toBe(true);
  });

  it("retries deleting files of withdrawn artworks", async () => {
    const id = await hostedArtwork();
    // 커밋 후 삭제가 실패한 상태를 흉내 낸다: 철회됐지만 파일 행이 남아 있음.
    await sql`update artworks set status = 'withdrawn', files_purged = false where id = ${id}`;

    expect(await cleanup()).toMatchObject({ withdrawn: 2 });
    expect(await storedPaths()).toEqual([]);
    const [row] = await sql`select files_purged from artworks where id = ${id}`;
    expect(row.files_purged).toBe(true);
  });

  it("leaves active artworks alone", async () => {
    const id = await hostedArtwork();
    await setStatus(id, "hidden", { actor: "test" });
    await cleanup(later());
    expect(await storedPaths()).toHaveLength(2);
  });

  it("drops report abuse counters after 24 hours", async () => {
    await sql`insert into report_throttle (ip_hash) values ('h1')`;
    expect(await cleanup()).toMatchObject({ throttle: 0 });
    expect(await cleanup(later())).toMatchObject({ throttle: 1 });
  });
});
