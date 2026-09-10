import type { ThemePreference } from "@/api/models";

export const DEFAULT_THEME: ThemePreference = "system";

/** The three choices, in the order the control offers them. */
export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export const DARK_QUERY = "(prefers-color-scheme: dark)";

/** What the preference means for this device right now. `system` is the OS's own answer. */
export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): "light" | "dark" {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

export function darkMediaQuery(): MediaQueryList | null {
  return typeof window.matchMedia === "function" ? window.matchMedia(DARK_QUERY) : null;
}

export function systemPrefersDark(): boolean {
  return darkMediaQuery()?.matches ?? false;
}

/**
 * The one place the theme reaches the DOM: the `dark` class Tailwind's dark variant reads, and
 * `color-scheme` so the browser paints its own widgets (scrollbars, form controls) to match.
 */
export function applyTheme(preference: ThemePreference): void {
  const resolved = resolveTheme(preference, systemPrefersDark());
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
}
