// The header's theme control with focus on it, so a change to it (or to anything else in the
// header) can be compared in both themes.
//
// Focused, not open: the control is a native <select> today (`src/components/native-select.tsx`)
// and a native option list is drawn by the operating system, outside the page, so it cannot appear
// in a screenshot. The capture shows the control's focus ring and its current value instead.
// A `theme-open` scenario returns the day the control becomes a `dropdown-menu` (see
// docs/ui-conventions.md: a short choice list is a dropdown-menu), whose menu is in the page.
export const route = "/tasks";

export async function ready(page) {
  await page.getByRole("heading", { name: "Tasks", level: 1 }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Theme").waitFor({ timeout: 15_000 });
}

export async function act(page) {
  await page.getByLabel("Theme").focus();
}
