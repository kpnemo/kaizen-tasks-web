import { screen, waitFor } from "@testing-library/react";
import { http } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import type { ThemePreference } from "@/api/models";
import { demoUser } from "../../../tests/msw/fixtures";
import { API, err, ok } from "../../../tests/msw/handlers";
import { server } from "../../../tests/msw/server";
import { renderApp } from "../../../tests/render";
import { THEME_STORAGE_KEY } from "./theme";

const original = window.matchMedia;

/** Pretends the operating system asks for dark (or light), the way a real browser would. */
function osPrefersDark(matches: boolean) {
  window.matchMedia = ((query: string) =>
    ({
      matches: query.includes("prefers-color-scheme: dark") ? matches : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList) as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = original;
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "";
  localStorage.clear();
});

/** The header's icon-only theme control: its accessible name states the current mode and what one
 *  more click switches to. */
const toggle = () => screen.getByRole("button", { name: /^Theme:/ });

/** Signs in with the given stored preference, the way a fresh device would. */
async function signInWith(theme: ThemePreference) {
  server.use(http.get(`${API}/auth/me`, () => ok({ user: { ...demoUser, theme } })));
  const rendered = renderApp({ route: "/tasks", session: "restoring" });
  await screen.findByRole("button", { name: /^Theme:/ });
  return rendered;
}

/** Gates `PATCH /auth/me` so a test can assert state while the save is genuinely mid-flight. */
function gatedSave(theme: ThemePreference) {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = () => resolve();
  });
  server.use(
    http.patch(`${API}/auth/me`, async () => {
      await gate;
      return ok({ user: { ...demoUser, theme } });
    }),
  );
  return () => release();
}

describe("theme toggle", () => {
  it("shows the icon and names the current mode on the control", async () => {
    await signInWith("dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(toggle()).toHaveAccessibleName("Theme: Dark, switch to System");
    expect(toggle().querySelector("svg")).toHaveClass("lucide-moon");
  });

  it("cycles light, dark, then system on each click", async () => {
    const { user } = await signInWith("light");
    expect(toggle()).toHaveAccessibleName("Theme: Light, switch to Dark");
    await user.click(toggle());
    await waitFor(() => expect(toggle()).toHaveAccessibleName("Theme: Dark, switch to System"));
    await user.click(toggle());
    await waitFor(() => expect(toggle()).toHaveAccessibleName("Theme: System, switch to Light"));
    await user.click(toggle());
    await waitFor(() => expect(toggle()).toHaveAccessibleName("Theme: Light, switch to Dark"));
  });

  it("applies the next theme to the document immediately on click", async () => {
    const { user } = await signInWith("light");
    await user.click(toggle());
    // No waitFor: the theme must be on the document before the save round trip finishes.
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("cycling from dark to system follows prefers-color-scheme", async () => {
    osPrefersDark(true);
    const { user } = await signInWith("dark");
    await user.click(toggle());
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("cycling from system to light removes the dark class", async () => {
    const { user } = await signInWith("system");
    await user.click(toggle());
    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("persists the chosen mode across reload", async () => {
    const saved: unknown[] = [];
    const { user } = await signInWith("system");
    server.use(
      http.patch(`${API}/auth/me`, async ({ request }) => {
        const body = await request.json();
        saved.push(body);
        return ok({ user: { ...demoUser, theme: "light" } });
      }),
    );
    await user.click(toggle());
    await waitFor(() => expect(saved).toEqual([{ theme: "light" }]));
    expect(toggle()).toHaveAccessibleName("Theme: Light, switch to Dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("shows the API error when saving fails and puts the choice back", async () => {
    const { user } = await signInWith("light");
    server.use(http.patch(`${API}/auth/me`, () => err("INTERNAL", "Could not save your theme")));
    await user.click(toggle());
    expect(await screen.findByText("Could not save your theme")).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement).not.toHaveClass("dark"));
    expect(toggle()).toHaveAccessibleName("Theme: Light, switch to Dark");
  });

  it("disables the control while a save is in flight, and re-enables it once it settles", async () => {
    const { user } = await signInWith("light");
    const release = gatedSave("dark");
    await user.click(toggle());
    // Optimistic apply still happens at once; only the save itself is gated.
    expect(document.documentElement).toHaveClass("dark");
    expect(toggle()).toBeDisabled();
    expect(toggle()).toHaveAccessibleName("Theme: Dark, switch to System");
    release();
    await waitFor(() => expect(toggle()).not.toBeDisabled());
  });

  it("the session user's saved theme overrides a different value cached on this device", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    await signInWith("dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(toggle()).toHaveAccessibleName("Theme: Dark, switch to System");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });
});
