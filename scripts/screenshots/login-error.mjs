// The sign-in screen after a wrong password: the destructive Alert ("Could not log in" plus the
// API's message) above the submit, with no field marked invalid. The runner arrives signed in, so
// ready() signs out first (see lib/signed-out.mjs).
import { signOut } from "./lib/signed-out.mjs";

export const route = "/login";

export async function ready(page) {
  await signOut(page, route);
  await page.getByRole("heading", { name: "Log in", level: 1 }).waitFor({ timeout: 15_000 });
}

export async function act(page) {
  await page.getByLabel("Email").fill("nobody@example.test");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByRole("alert").waitFor({ timeout: 15_000 });
}
