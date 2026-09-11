// The header's theme control, open. The control is a dropdown-menu, so its three choices, their
// icons and the checked one are drawn inside the page and can be compared in both themes; it also
// shows the whole header (brand, primary nav with icons, the truncated display name, log out).
// Replaces theme-focused, which could only show a native select's focus ring.
export const route = "/tasks";

export async function ready(page) {
  await page.getByRole("heading", { name: "Tasks", level: 1 }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Theme" }).waitFor({ timeout: 15_000 });
}

export async function act(page) {
  await page.getByRole("button", { name: "Theme" }).click();
  await page.getByRole("menuitemradio", { name: "System" }).waitFor({ timeout: 5_000 });
}
