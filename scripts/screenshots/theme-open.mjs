// The header's theme control, focused, so a change to it (or to anything else in the header) can be
// compared in both themes.
//
// The control is a native <select> today (`src/components/native-select.tsx`), and a native option
// list is drawn by the operating system, outside the page: it cannot appear in a screenshot. So the
// scenario focuses the control instead, which shows its focus ring and its current value. When the
// control becomes a `dropdown-menu` (see docs/ui-conventions.md: a short choice list is a
// dropdown-menu), change `act` to click it and wait for the menu.
export const route = "/tasks";

export async function ready(page) {
  await page.getByRole("heading", { name: "Tasks", level: 1 }).waitFor({ timeout: 15_000 });
  await page.getByLabel("Theme").waitFor({ timeout: 15_000 });
}

export async function act(page) {
  await page.getByLabel("Theme").focus();
}
