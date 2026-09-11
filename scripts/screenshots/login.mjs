// The sign-in screen: the Card centred in the projector's viewport, wordmark, heading, the two
// fields, the iconed submit and the link to registration. The runner arrives signed in, so ready()
// signs out first (see lib/signed-out.mjs).
import { signOut } from "./lib/signed-out.mjs";

export const route = "/login";

export async function ready(page) {
  await signOut(page, route);
  await page.getByRole("heading", { name: "Log in", level: 1 }).waitFor({ timeout: 15_000 });
  await page.getByRole("link", { name: "Create an account" }).waitFor({ timeout: 15_000 });
}
