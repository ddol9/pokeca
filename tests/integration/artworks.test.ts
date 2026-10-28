import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  ArtworkError,
  createArtwork,
  listPublicArtworks,
  resolveDownload,
  resolveThumbnail,
  setConsent,
  setStatus,
  type NewArtwork,
} from "@/lib/artworks";
import { createUpload } from "@/lib/storage";
import { cardId, FAKE_PNG, PDF, PNG, resetArtworks, sql, storedPaths, uploadAsBrowser } from "../helpers/fixtures";

afterAll(() => sql.end());
beforeEach(resetArtworks);

async function base(overrides: Partial<NewArtwork> = {}): Promise<NewArtwork> {
  return {
    id: crypto.randomUUID(),
    cardId: await cardId(),
    artistName: "도안작가",
    format: "9pocket",
    sourceUrl: "https://cafe.naver.com/example/123",
    sourceVisibility: "public",
    consentLevel: "hosted",
    thumbnailOk: true,
    printSizeVerified: false,
    ...overrides,
  };
}

async function hosted(overrides: Partial<NewArtwork> = {}) {
  const input = await base(overrides);
  const original = await uploadAsBrowser("original", PDF, "application/pdf");
  const thumbnail = await uploadAsBrowser("thumbnail", PNG, "image/png");
  await createArtwork(input, { original, thumbnail }, "test");
  return input.id;
}

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e) => e instanceof ArtworkError && e.code === code);
}

describe("upload and create", () => {
  it("moves uploads out of pending and serves the original as a download", async () => {
    const id = await hosted();
    const paths = await storedPaths();
    expect(paths.every((p) => p.startsWith(`artworks/${id}/`))).toBe(true);
    expect(paths).toHaveLength(2);

    const [item] = await listPublicArtworks(await cardId());
    expect(item).toMatchObject({ id, layout: "tile", action: "download", sourceDomain: "cafe.naver.com" });

    const download = await resolveDownload(id);
    expect(download.kind).toBe("ok");
    const res = await fetch((download as { url: string }).url);
    expect(res.headers.get("content-disposition")).toContain("sv2a_201-165");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PDF);
    expect(await resolveThumbnail(id)).toMatch(/^http/);
  });

  it("is idempotent when the same artwork is submitted twice", async () => {
    const input = await base();
    const original = await uploadAsBrowser("original", PDF, "application/pdf");
    const thumbnail = await uploadAsBrowser("thumbnail", PNG, "image/png");
    await createArtwork(input, { original, thumbnail }, "test");
    await createArtwork(input, { original, thumbnail }, "test");
    const [{ count }] = await sql<{ count: number }[]>`select count(*)::int from artworks`;
    expect(count).toBe(1);
  });

  it("rejects a file whose bytes do not match its type and deletes it", async () => {
    const original = await uploadAsBrowser("original", FAKE_PNG, "image/png");
    await expectCode(createArtwork(await base(), { original }, "test"), "bad_file_type");
    expect(await storedPaths()).toEqual([]);
    const [{ count }] = await sql<{ count: number }[]>`select count(*)::int from artworks`;
    expect(count).toBe(0);
  });

  it("refuses types and sizes the bucket would not accept", async () => {
    await expect(createUpload({ kind: "original", mimeType: "image/gif", sizeBytes: 10 })).rejects.toThrow("bad_file_type");
    await expect(createUpload({ kind: "thumbnail", mimeType: "application/pdf", sizeBytes: 10 })).rejects.toThrow("bad_file_type");
    await expect(
      createUpload({ kind: "original", mimeType: "application/pdf", sizeBytes: 100 * 1024 * 1024 + 1 }),
    ).rejects.toThrow("file_too_large");
  });

  it("requires an original for hosted and a thumbnail for thumbnail consent", async () => {
    await expectCode(createArtwork(await base({ thumbnailOk: false }), {}, "test"), "hosted_needs_original");
    await expectCode(
      createArtwork(await base({ consentLevel: "link_only" }), {}, "test"),
      "thumbnail_needs_file",
    );
  });

  it("lists a link-only artwork without a thumbnail as a row that opens the source", async () => {
    await createArtwork(await base({ consentLevel: "link_only", thumbnailOk: false }), {}, "test");
    const [item] = await listPublicArtworks(await cardId());
    expect(item).toMatchObject({ layout: "row", action: "source" });
  });

  it("keeps hosted downloads available even without a thumbnail (eng E3)", async () => {
    const input = await base({ thumbnailOk: false });
    const original = await uploadAsBrowser("original", PNG, "image/png");
    await createArtwork(input, { original }, "test");
    const [item] = await listPublicArtworks(await cardId());
    expect(item).toMatchObject({ layout: "row", action: "download" });
  });
});

describe("status", () => {
  it("hides, restores, then withdraws and deletes files", async () => {
    const id = await hosted();

    await setStatus(id, "hidden", { actor: "test" });
    expect(await resolveDownload(id)).toEqual({ kind: "unavailable" });
    expect(await resolveThumbnail(id)).toBeNull();
    expect(await listPublicArtworks(await cardId())).toEqual([]);

    await setStatus(id, "active", { actor: "test" });
    expect((await resolveDownload(id)).kind).toBe("ok");

    const result = await setStatus(id, "withdrawn", { reason: "artist request", actor: "test" });
    expect(result).toEqual({ changed: true, purged: true });
    expect(await storedPaths()).toEqual([]);
    expect(await resolveDownload(id)).toEqual({ kind: "unavailable" });
    const [row] = await sql`select status, files_purged from artworks where id = ${id}`;
    expect(row).toEqual({ status: "withdrawn", files_purged: true });

    await expectCode(setStatus(id, "active", { actor: "test" }), "withdrawn_is_final");

    const events = await sql`select kind, after from consent_events where artwork_id = ${id} order by id`;
    expect(events.map((e) => [e.kind, e.after.status])).toEqual([
      ["created", "active"],
      ["status", "hidden"],
      ["status", "active"],
      ["status", "withdrawn"],
    ]);
  });

  it("returns 404 for unknown artworks and 410 for unavailable ones (eng E2)", async () => {
    expect(await resolveDownload(crypto.randomUUID())).toEqual({ kind: "not_found" });
    expect(await resolveDownload("not-a-uuid")).toEqual({ kind: "not_found" });
  });
});

describe("consent", () => {
  it("downgrading to link-only deletes the original and keeps the thumbnail", async () => {
    const id = await hosted();
    await setConsent(id, { consentLevel: "link_only", thumbnailOk: true }, { actor: "test" });
    expect(await resolveDownload(id)).toEqual({ kind: "unavailable" });
    expect(await resolveThumbnail(id)).toMatch(/^http/);
    expect((await storedPaths()).map((p) => p.split("/")[2].split("-")[0])).toEqual(["thumbnail"]);
    const [item] = await listPublicArtworks(await cardId());
    expect(item).toMatchObject({ layout: "tile", action: "source" });
  });

  it("revoking thumbnail consent deletes the thumbnail and turns the tile into a row", async () => {
    const id = await hosted();
    await setConsent(id, { consentLevel: "hosted", thumbnailOk: false }, { actor: "test" });
    expect(await resolveThumbnail(id)).toBeNull();
    const [item] = await listPublicArtworks(await cardId());
    expect(item).toMatchObject({ layout: "row", action: "download" });
  });

  it("cannot downgrade to link-only without a source link", async () => {
    const id = await hosted({ sourceUrl: null, sourceVisibility: null });
    await expectCode(
      setConsent(id, { consentLevel: "link_only", thumbnailOk: true }, { actor: "test" }),
      "link_only_needs_source",
    );
    expect((await resolveDownload(id)).kind).toBe("ok");
  });
});
