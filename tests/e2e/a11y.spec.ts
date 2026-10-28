import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// design 10A: 공개 화면은 axe 위반 0개여야 한다. 화면이 늘어날 때마다 경로를 추가한다.
const publicPages = ["/", "/search?q=ex", "/search?q=sv2a 999", "/cards/sv2a/201-165", "/cards/sv2a/999-165"];

for (const path of publicPages) {
  test(`${path} has no axe violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}

test("home search input has a visible label", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("카드 번호 또는 이름")).toBeVisible();
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
});
