import { screen, waitFor } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
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

/** The header's theme control: a menu button named "Theme" (the smoke contract) whose visible
 *  text is the current choice. */
const toggle = () => screen.getByRole("button", { name: "Theme" });

/** Signs in with the given stored preference, the way a fresh device would. */
async function signInWith(theme: ThemePreference) {
  server.use(http.get(`${API}/auth/me`, () => ok({ user: { ...demoUser, theme } })));
  const rendered = renderApp({ route: "/tasks", session: "restoring" });
  await screen.findByRole("button", { name: "Theme" });
  return rendered;
}

/** Opens the menu and picks one of its three choices, the way a person would. */
async function choose(user: UserEvent, label: "Light" | "Dark" | "System") {
  await user.click(toggle());
  await user.click(await screen.findByRole("menuitemradio", { name: label }));
}

/** Gates `PATCH /auth/me` so a test can assert state while the save is genuinely mid-flight,
 *  the way `gatedTurn` in the feature-request tests does for its streamed turn. */
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
  it("applies the theme stored on the session user, names it on the control and checks it in the menu", async () => {
    const { user } = await signInWith("dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(toggle()).toHaveTextContent("Dark");
    // The icon carries the choice on its own where the header hides the word (below lg).
    expect(toggle().querySelector("svg")).toHaveClass("lucide-moon");
    await user.click(toggle());
    const items = await screen.findAllByRole("menuitemradio");
    expect(items.map((item) => item.textContent)).toEqual(["Light", "Dark", "System"]);
    expect(screen.getByRole("menuitemradio", { name: "Dark" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemradio", { name: "Light" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("choosing Dark applies the dark theme immediately", async () => {
    const { user } = await signInWith("light");
    await choose(user, "Dark");
    // No waitFor: the theme must be on the document before the save round trip finishes.
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("choosing Light applies the light theme immediately", async () => {
    const { user } = await signInWith("dark");
    await choose(user, "Light");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("choosing System follows prefers-color-scheme", async () => {
    osPrefersDark(true);
    const { user } = await signInWith("light");
    expect(document.documentElement).not.toHaveClass("dark");
    await choose(user, "System");
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("saves the choice to the account", async () => {
    const saved: unknown[] = [];
    const { user } = await signInWith("system");
    server.use(
      http.patch(`${API}/auth/me`, async ({ request }) => {
        const body = await request.json();
        saved.push(body);
        return ok({ user: { ...demoUser, theme: "dark" } });
      }),
    );
    await choose(user, "Dark");
    await waitFor(() => expect(saved).toEqual([{ theme: "dark" }]));
    expect(toggle()).toHaveTextContent("Dark");
  });

  it("shows the API error when saving fails and puts the choice back", async () => {
    const { user } = await signInWith("light");
    server.use(http.patch(`${API}/auth/me`, () => err("INTERNAL", "Could not save your theme")));
    await choose(user, "Dark");
    expect(await screen.findByText("Could not save your theme")).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement).not.toHaveClass("dark"));
    expect(toggle()).toHaveTextContent("Light");
  });

  it("disables the control while a save is in flight, and re-enables it once it settles", async () => {
    const { user } = await signInWith("light");
    const release = gatedSave("dark");
    await choose(user, "Dark");
    // Optimistic apply still happens at once; only the save itself is gated.
    expect(document.documentElement).toHaveClass("dark");
    expect(toggle()).toBeDisabled();
    release();
    await waitFor(() => expect(toggle()).not.toBeDisabled());
    expect(toggle()).toHaveTextContent("Dark");
  });

  it("the session user's saved theme overrides a different value cached on this device", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    await signInWith("dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(toggle()).toHaveTextContent("Dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });
});
