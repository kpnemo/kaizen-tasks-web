// The sign-up screen after a too-short password: the API's validation detail lands on the password
// field as a field error, with the rule "At least 8 characters" still on screen beside it. The
// runner arrives signed in, so ready() signs out first (see lib/signed-out.mjs).
import { signOut } from "./lib/signed-out.mjs";

export const route = "/register";

export async function ready(page) {
  await signOut(page, route);
  await page
    .getByRole("heading", { name: "Create your account", level: 1 })
    .waitFor({ timeout: 15_000 });
}

export async function act(page) {
  await page.getByLabel("Email").fill(`short-${Date.now()}@example.test`);
  await page.getByLabel("Password").fill("short");
  await page.getByLabel("Display name").fill("Screenshot");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("alert").waitFor({ timeout: 15_000 });
}
