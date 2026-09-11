// Shared by the signed-out scenarios (login, register). Not a scenario itself: it exports no route.
//
// The runner registers a user and logs in before any capture, and PublicOnly sends a signed-in
// visitor away from /login and /register to /tasks. A signed-out scenario therefore logs out inside
// ready(), before the runner compares the route, and then returns to its own route. The anonymous
// page shows the device's cached theme, not an account's, so the cache is set to "system" first:
// the runner emulates the OS colour scheme for each capture, and "system" follows it, which is how
// the dark capture of a signed-out screen can exist at all.
export async function signOut(page, route) {
  const accountMenu = page.getByRole("button", { name: "Screenshot" });
  const heading = page.getByRole("heading", { level: 1 });
  await accountMenu.or(heading).first().waitFor({ timeout: 15_000 });
  if (!(await accountMenu.isVisible())) return;
  await page.evaluate(() => localStorage.setItem("kaizen.theme", "system"));
  await accountMenu.click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await page.waitForURL(/\/login/, { timeout: 15_000 });
  await page.goto(new URL(route, page.url()).href, { waitUntil: "domcontentloaded" });
}
