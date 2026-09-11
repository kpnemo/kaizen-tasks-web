// The sign-up screen: the same Card as login with three fields, the password rule under its field,
// and the "Create account" button inside the fold. The runner arrives signed in, so ready() signs
// out first (see lib/signed-out.mjs).
import { signOut } from "./lib/signed-out.mjs";

export const route = "/register";

export async function ready(page) {
  await signOut(page, route);
  await page
    .getByRole("heading", { name: "Create your account", level: 1 })
    .waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Create account" }).waitFor({ timeout: 15_000 });
}
