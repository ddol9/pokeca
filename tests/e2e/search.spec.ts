import { expect, test } from "@playwright/test";

// seed.sql: sv2a 201/165 리자몽 ex (영문 별칭 MEW 199/165), sv2a 205/165 뮤 ex
test("card number search goes straight to the card", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("카드 번호 또는 이름").fill("SV2A 201/165");
  await page.getByLabel("카드 번호 또는 이름").press("Enter");
  await expect(page).toHaveURL(/\/cards\/sv2a\/201-165$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("sv2a 201/165");
  await expect(page.getByText("리자몽 ex")).toBeVisible();
});

test("alias search explains it landed on the Korean card", async ({ page }) => {
  await page.goto("/search?q=MEW 199/165");
  await expect(page).toHaveURL(/\/cards\/sv2a\/201-165\?from=en/);
  await expect(page.getByText("MEW 199/165(영문판)과 같은 그림의 한글판 카드예요")).toBeVisible();
});

test("canonical search shows no alias note", async ({ page }) => {
  await page.goto("/search?q=sv2a 201");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("sv2a 201/165");
  await expect(page.getByText("같은 그림의 한글판 카드예요")).toHaveCount(0);
});

test("name search lists candidates", async ({ page }) => {
  await page.goto("/search?q=ex");
  await expect(page.getByRole("heading", { name: "카드 2장" })).toBeVisible();
  await page.getByRole("link", { name: "뮤 ex" }).click();
  await expect(page).toHaveURL(/\/cards\/sv2a\/205-165$/);
});

test("unknown card shows the miss message", async ({ page }) => {
  await page.goto("/search?q=sv2a 999/165");
  await expect(page.getByRole("heading", { name: "‘sv2a 999/165’에 맞는 카드를 못 찾았어요" })).toBeVisible();
});

test("unknown card URL shows the not-in-list page", async ({ page }) => {
  // 카드 조회가 스트리밍 안에서 일어나서 상태 코드는 200이다. Next가 noindex 메타를 붙인다.
  await page.goto("/cards/sv2a/999-165");
  await expect(page.getByRole("heading", { name: "이 카드는 아직 목록에 없어요" })).toBeVisible();
});
