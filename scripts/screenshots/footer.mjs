// The footer's version line, scrolled into view under the sticky header. Against a local API whose
// version differs from this build, the API segment is the destructive badge with its visible note;
// against a matching one, the outline badge.
export const route = "/tasks";

export async function ready(page) {
  await page.getByRole("heading", { name: "Tasks", level: 1 }).waitFor({ timeout: 15_000 });
  await page.getByRole("contentinfo").getByText(/^api /).waitFor({ timeout: 15_000 });
}

export async function act(page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(200);
}
