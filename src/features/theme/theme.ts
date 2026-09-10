import type { ThemePreference } from "@/api/models";

export const DEFAULT_THEME: ThemePreference = "system";

/** The three choices, in the order the control offers them. */
export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Per-device cache of the last applied theme, not the account (ADR 0006). Not sensitive, so
 *  `localStorage` is fine even though ADR 0003 keeps the access token in memory only. Read by the
 *  inline script in `index.html` before first paint, and by `useThemePreference` before the session
 *  user is known, so neither shows the wrong theme and then flips once the real one arrives. */
export const THEME_STORAGE_KEY = "kaizen.theme";

/** The cached preference, or `null` when there is none yet or storage is unavailable. */
export function readStoredTheme(): ThemePreference | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" || value === "system" ? value : null;
  } catch {
    return null;
  }
}

function writeStoredTheme(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage blocked (private mode, disabled cookies, a full quota): the theme still applies to
    // this page, it just will not be cached for the next load.
  }
}

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
  writeStoredTheme(preference);
}
