import { describe, expect, it } from "vitest";
import { sortArtworks } from "./artworks";

describe("sortArtworks", () => {
  it("puts tiles before rows, then design 12A rank, then newest first", () => {
    const items = [
      { id: "row-hosted", layout: "row", rank: 1, createdAt: "2026-10-01" },
      { id: "tile-link", layout: "tile", rank: 2, createdAt: "2026-10-03" },
      { id: "tile-hosted-old", layout: "tile", rank: 1, createdAt: "2026-10-01" },
      { id: "tile-hosted-new", layout: "tile", rank: 1, createdAt: "2026-10-02" },
      { id: "row-deleted", layout: "row", rank: 5, createdAt: "2026-10-09" },
      { id: "row-members", layout: "row", rank: 4, createdAt: "2026-10-09" },
    ] as const;
    expect(sortArtworks([...items]).map((i) => i.id)).toEqual([
      "tile-hosted-new",
      "tile-hosted-old",
      "tile-link",
      "row-hosted",
      "row-members",
      "row-deleted",
    ]);
  });
});
