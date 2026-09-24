import { expect, test } from "@playwright/test";

// Subtitles wave word by word (components/wave-text.tsx, by="word"). The words
// must stay one run of text, or the browser's find-in-page can no longer
// match a phrase that spans two of them.
test("finds a phrase inside a waving subtitle, and hovering still lifts its words", async ({
  page,
}) => {
  await page.goto("/");
  const subtitle = page.locator("p", { hasText: "Not a chatbot bolted onto a form." });
  await expect(subtitle.locator(".wave-line")).toHaveCount(1);

  const matches = (phrase: string) =>
    page.evaluate((q) => {
      const find = (window as unknown as { find: (q: string, ...flags: boolean[]) => boolean }).find;
      getSelection()?.removeAllRanges();
      let n = 0;
      while (n < 5 && find(q, false, false, false, false, false, false)) n++;
      getSelection()?.removeAllRanges();
      return n;
    }, phrase);

  expect(await matches("Not a chatbot")).toBe(1);
  expect(await matches("close the tab")).toBe(1);
  expect(await matches("search venues")).toBe(1);

  // The last word's height above its paragraph, so scrolling to hover
  // doesn't count as a lift.
  const lastWord = subtitle.locator(".wave-ch").last();
  const top = () =>
    lastWord.evaluate(
      (el) => el.getBoundingClientRect().top - el.closest("p")!.getBoundingClientRect().top,
    );
  const before = await top();
  await subtitle.locator(".wave-line").hover();
  await expect.poll(top).toBeLessThan(before - 1);
});
