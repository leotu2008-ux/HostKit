import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Clubs: one person starts a club and posts a night as it; a second person
 * joins, sees the night, is refused at the members page, gets promoted, and
 * is then let in. Two browser contexts, because the whole point is that the
 * second person is not the first.
 */

const PASSWORD = "correcthorse1";

async function signUp(page: Page, name: string) {
  const email = `clubs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto("/signup");
  await page.fill('input[name="name"]', name);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/events");
  return email;
}

async function freshUser(browser: Browser, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signUp(page, name);
  return { context, page };
}

test("a club can be started, joined, and run by more than one person", async ({
  browser,
}) => {
  const owner = await freshUser(browser, "Ada Owner");
  const clubName = `Run Club ${Date.now().toString(36)}`;
  let clubUrl = "";
  let nightUrl = "";

  await test.step("owner starts a club", async () => {
    await owner.page.goto("/clubs/new");
    await owner.page.fill('input[name="name"]', clubName);
    await owner.page.fill('input[name="city"]', "New York, NY");
    await owner.page.fill('textarea[name="description"]', "Easy 5k, then a drink.");
    await owner.page.click('button:has-text("Start the club")');
    await owner.page.waitForURL(/\/c\/[a-z0-9-]+$/);
    clubUrl = new URL(owner.page.url()).pathname;

    await expect(owner.page.getByRole("heading", { name: clubName })).toBeVisible();
    await expect(owner.page.getByText("1 member")).toBeVisible();
    // The creator is the owner, with the management affordances.
    await expect(owner.page.getByText("Owner", { exact: true })).toBeVisible();
    await expect(owner.page.getByRole("link", { name: "Members" })).toBeVisible();
  });

  await test.step("owner posts a night as the club", async () => {
    await owner.page.getByRole("link", { name: "Post a night" }).first().click();
    await owner.page.waitForURL(/\/events\/new\?club=/);
    // The club arrived via ?club= and is preselected.
    const postAs = owner.page.locator('select[name="clubId"]');
    await expect(postAs).toBeVisible();
    await expect(postAs.locator("option:checked")).toHaveText(clubName);

    await owner.page.click('button:has-text("Birthday")');
    await owner.page.fill('input[name="title"]', "Tuesday 5k");
    const date = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    await owner.page.fill('input[name="date"]', date);
    await owner.page.fill('input[name="time"]', "18:30");
    await owner.page.fill('input[name="address"]', "Prospect Park, Brooklyn");
    await owner.page.fill('input[name="guestCount"]', "20");
    await owner.page.fill('input[name="budget"]', "200");
    await owner.page.click('button:has-text("Save this night")');
    await owner.page.waitForURL((url) => /\/events\/[a-z0-9]{8,}$/.test(url.pathname));
    nightUrl = new URL(owner.page.url()).pathname;

    await owner.page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(
      owner.page.getByRole("button", { name: "Publish", exact: true }),
    ).toHaveCount(0);
  });

  await test.step("the night shows on the club page", async () => {
    await owner.page.goto(clubUrl);
    await expect(owner.page.getByText("Tuesday 5k")).toBeVisible();
  });

  const member = await freshUser(browser, "Bo Member");

  await test.step("someone else joins and sees the night", async () => {
    await member.page.goto(clubUrl);
    await expect(member.page.getByText("Tuesday 5k")).toBeVisible();
    await member.page.click('button:has-text("Join")');
    await expect(member.page.getByText("Member", { exact: true })).toBeVisible();
    await expect(member.page.getByRole("button", { name: "Leave" })).toBeVisible();
    await expect(member.page.getByText("2 members")).toBeVisible();
  });

  await test.step("a plain member is refused at the members page", async () => {
    await member.page.goto(`${clubUrl}/members`);
    // requireClub redirects members without the role back to the club page.
    await expect(member.page).toHaveURL(new RegExp(`${clubUrl}$`));
    await expect(member.page.getByRole("heading", { name: "Members" })).toHaveCount(0);
  });

  await test.step("the public night page credits the club", async () => {
    const id = nightUrl.split("/").pop();
    await member.page.goto(`/e/${id}`);
    await expect(member.page.getByText("Hosted by")).toBeVisible();
    await expect(member.page.getByRole("link", { name: clubName })).toHaveAttribute(
      "href",
      clubUrl,
    );
  });

  await test.step("owner promotes the member to admin", async () => {
    await owner.page.goto(`${clubUrl}/members`);
    await expect(owner.page.getByRole("heading", { name: "Members" })).toBeVisible();
    // The owner's own row has no controls — you can't edit your own role.
    await expect(owner.page.getByLabel("Role for Ada Owner")).toHaveCount(0);

    const select = owner.page.getByLabel("Role for Bo Member");
    await select.selectOption("ADMIN");
    await select.locator("xpath=..").getByRole("button", { name: "Save" }).click();
    await expect(owner.page.getByLabel("Role for Bo Member")).toHaveValue("ADMIN");
  });

  await test.step("the new admin can now manage members", async () => {
    await member.page.goto(`${clubUrl}/members`);
    await expect(member.page.getByRole("heading", { name: "Members" })).toBeVisible();
    // An admin sees no way to touch the owner: the row is a plain badge.
    await expect(member.page.getByLabel("Role for Ada Owner")).toHaveCount(0);
    await expect(member.page.getByRole("button", { name: "Remove Ada Owner" })).toHaveCount(0);
  });

  await test.step("the night appears in the admin's own Nights list", async () => {
    await member.page.goto("/events");
    await expect(member.page.getByText("Tuesday 5k")).toBeVisible();
  });

  await owner.context.close();
  await member.context.close();
});
