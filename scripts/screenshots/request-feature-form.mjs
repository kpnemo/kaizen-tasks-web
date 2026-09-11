// The plain five-field form (?mode=form), reached the way a user reaches it: through the "Skip the
// interview, fill the form" link on the interview, so the URL's pathname stays the route the runner
// asserts before the shutter.
export const route = "/request-feature";

export async function ready(page) {
  const skip = page.getByRole("link", { name: "Skip the interview, fill the form" });
  await skip.waitFor({ timeout: 20_000 });
  await skip.click();
  await page.getByRole("form", { name: "Request a feature" }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Title").waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Send request" }).waitFor({ timeout: 15_000 });
  // A client-side navigation keeps the scroll position the link had; the capture wants the top.
  await page.evaluate(() => window.scrollTo(0, 0));
}
