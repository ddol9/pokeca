import { expect, test } from "@playwright/test";

test.skip(({ isMobile }) => isMobile, "API test runs once");

test("admin APIs reject requests without an admin session", async ({ request }) => {
  const id = crypto.randomUUID();
  const calls = [
    request.post("/api/admin/uploads", { data: { kind: "original", mimeType: "image/png", sizeBytes: 10 } }),
    request.post("/api/admin/artworks", { data: { id } }),
    request.patch(`/api/admin/artworks/${id}`, { data: { action: "withdraw" } }),
    request.post(`/api/admin/artworks/${id}/files`, { data: { kind: "original", uploadId: id } }),
  ];
  for (const res of await Promise.all(calls)) {
    expect(res.status()).toBe(401);
  }
});

test("cleanup cron rejects calls without the secret", async ({ request }) => {
  expect((await request.get("/api/cron/cleanup")).status()).toBe(401);
});
