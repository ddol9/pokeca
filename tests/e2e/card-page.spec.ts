import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { clearArtworks, seedArtwork, sql } from "./db";

// 카드 상세 작품 목록 (design 4A·5A·6A·7A·14A, eng E3·E4·E5·E8).
test.describe.configure({ mode: "serial" });
test.beforeEach(clearArtworks);

const CARD = "/cards/sv2a/201-165";
const EMPTY_CARD = "/cards/sv2a/205-165";

async function artists(page: Page, list: string) {
  return page.getByRole("list", { name: list }).locator("strong").allTextContents();
}

test("tiles come before rows, design 12A order inside each section (eng E4)", async ({ page }) => {
  await seedArtwork({ artist: "링크타일", consent: "link_only", thumbnail: true });
  await seedArtwork({ artist: "보관타일", consent: "hosted", thumbnail: true });
  await seedArtwork({ artist: "삭제행", consent: "link_only", thumbnail: false, linkStatus: "deleted" });
  await seedArtwork({ artist: "회원행", consent: "link_only", thumbnail: false, visibility: "members_only" });
  await seedArtwork({ artist: "링크행", consent: "link_only", thumbnail: false });
  await seedArtwork({ artist: "보관행", consent: "hosted", thumbnail: false });

  await page.goto(CARD);
  await expect(page.getByRole("heading", { name: "확장 아트 도안 6개" })).toBeVisible();
  await expect(page.getByRole("img").first()).toBeVisible();
  expect(await artists(page, "미리보기가 있는 도안")).toEqual(["@보관타일", "@링크타일"]);
  expect(await artists(page, "미리보기가 없는 도안")).toEqual(["@보관행", "@링크행", "@회원행", "@삭제행"]);

  // 썸네일 없는 보관 작품도 다운로드할 수 있다 (eng E3).
  const rows = page.getByRole("list", { name: "미리보기가 없는 도안" }).getByRole("listitem");
  await expect(rows.nth(0).getByRole("button", { name: /다운로드/ })).toBeVisible();
  await expect(rows.nth(1).getByRole("link", { name: /원본 글 보기 ↗ ?\(새 탭\)/ })).toHaveAttribute("target", "_blank");
  await expect(rows.nth(2)).toContainText("카페 가입 필요");
  await expect(rows.nth(3).getByRole("button", { name: "원본 글 보기" })).toBeDisabled();
  await expect(rows.nth(3)).toContainText("원본 글이 사라졌어요");

  await expect(page.getByRole("img", { name: "@보관타일의 9포켓 확장 아트 도안" })).toBeVisible();

  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});

test("download starts and shows print guidance with verified size (eng E8)", async ({ page }) => {
  await seedArtwork({ artist: "치수확인", printSizeVerified: true });
  await page.goto(CARD);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: /다운로드/ }).click();
  expect((await downloading).suggestedFilename()).toContain("sv2a_201-165");
  await expect(page.getByText("‘실제 크기(100%)’로")).toBeVisible();
  await expect(page.getByText("9포켓 조각 8장, 각 63×88 mm로 확인됐어요")).toBeVisible();
});

for (const format of ["psa", "brg"] as const) {
  test(`a verified ${format} file shows the storage case's inner size`, async ({ page }) => {
    await seedArtwork({ artist: "슬랩확인", format, printSizeVerified: true });
    await page.goto(CARD);
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: /다운로드/ }).click();
    await downloading;
    await expect(page.getByText(`${format.toUpperCase()} 보관 케이스 안쪽 80×135 mm로 확인됐어요`)).toBeVisible();
  });
}

test("unverified files point to the artist's own print guide", async ({ page }) => {
  await seedArtwork({ artist: "미확인", format: "psa" });
  await page.goto(CARD);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: /다운로드/ }).click();
  await downloading;
  await expect(page.getByText("작가의 원본 글에 있는 인쇄 안내를 함께 확인하세요")).toBeVisible();
  await expect(page.getByText(/mm로 확인됐어요/)).toHaveCount(0);
});

test("an artwork hidden after the page loaded says it is no longer offered", async ({ page }) => {
  const id = await seedArtwork({ artist: "곧숨김" });
  await page.goto(CARD);
  await sql`update artworks set status = 'hidden' where id = ${id}`;
  await page.getByRole("button", { name: /다운로드/ }).click();
  await expect(page.getByText("이 도안은 더 이상 제공되지 않아요")).toBeVisible();
});

test("empty format chip shows the find request only when selected, and it sticks (design 5A)", async ({ page }) => {
  await seedArtwork({ artist: "구포켓", format: "9pocket" });
  await page.goto(CARD);
  await expect(page.getByText("도안 찾아 주세요")).toHaveCount(0);

  await page.getByRole("button", { name: /^BRG/ }).click();
  await expect(page.getByRole("button", { name: /^BRG/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "이 카드의 BRG 도안 찾아 주세요" })).toBeVisible();
  await page.getByRole("button", { name: "찾기 요청" }).click();
  await expect(page.getByText("요청이 기록됐어요 · 등록되면 이 페이지에 나타나요")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: /^BRG/ }).click();
  await expect(page.getByText("요청이 기록됐어요 · 등록되면 이 페이지에 나타나요")).toBeVisible();
  await expect(page.getByRole("button", { name: "찾기 요청" })).toHaveCount(0);
});

test("a card with no artworks asks which format, and shows waiting counts from 3 (eng E5)", async ({ page }) => {
  const [card] = await sql<{ id: string }[]>`select id from cards where set_code = 'sv2a' and collector_number = '205/165'`;
  for (let i = 0; i < 3; i++) {
    await sql`insert into requests (card_id, format, visitor_id) values (${card.id}, 'brg', ${crypto.randomUUID()})`;
  }
  await page.goto(EMPTY_CARD);
  await expect(page.getByText("어떤 규격이 필요하세요?")).toBeVisible();
  await expect(page.getByText("3명이 기다리는 중")).toBeVisible();

  await page.getByRole("button", { name: "PSA 찾기 요청" }).click();
  await expect(page.getByRole("button", { name: "PSA 요청함" })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole("button", { name: "PSA 요청함" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "PSA 0 요청함" })).toHaveAttribute("aria-pressed", "false");

  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::int from requests where card_id = ${card.id} and format = 'psa'`;
  expect(count).toBe(1);
});

test("report dialog from the ··· menu saves a report (design 14A)", async ({ page }) => {
  const id = await seedArtwork({ artist: "신고대상" });
  await page.goto(CARD);
  await page.getByRole("button", { name: "@신고대상 도안 더보기" }).click();
  await page.getByRole("button", { name: "신고·내림 요청" }).click();
  const dialog = page.getByRole("dialog", { name: "신고·내림 요청" });
  await dialog.getByLabel("도용 의심").check();
  await dialog.getByRole("button", { name: "보내기" }).click();
  await expect(dialog.getByText("신고가 접수됐어요. 확인 후 처리할게요.")).toBeVisible();

  const [row] = await sql`select artwork_id, reason, status from reports`;
  expect(row).toMatchObject({ artwork_id: id, reason: "suspected_theft", status: "open" });
});

test("footer takedown form takes a source URL without an artwork", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "권리자 내림 요청" }).click();
  await page.getByLabel("원본 글 또는 도안 주소").fill("https://cafe.naver.com/pokeca/999");
  await page.getByRole("button", { name: "보내기" }).click();
  await expect(page.getByText("신고가 접수됐어요")).toBeVisible();
  const [row] = await sql`select artwork_id, source_url from reports`;
  expect(row).toMatchObject({ artwork_id: null, source_url: "https://cafe.naver.com/pokeca/999" });
});

test("home lists cards with recently added artworks (design 3A)", async ({ page }) => {
  await seedArtwork();
  await page.goto("/");
  const recent = page.getByRole("region", { name: "최근 도안이 등록된 카드" });
  await recent.getByRole("link", { name: /sv2a 201\/165/ }).click();
  await expect(page).toHaveURL(/\/cards\/sv2a\/201-165$/);
});
