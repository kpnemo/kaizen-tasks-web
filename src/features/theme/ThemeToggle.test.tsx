import { screen, waitFor } from "@testing-library/react";
import { http } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import type { ThemePreference } from "@/api/models";
import { demoUser } from "../../../tests/msw/fixtures";
import { API, err, ok } from "../../../tests/msw/handlers";
import { server } from "../../../tests/msw/server";
import { renderApp } from "../../../tests/render";

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
});

const toggle = () => screen.getByRole("combobox", { name: "Theme" });

/** Signs in with the given stored preference, the way a fresh device would. */
async function signInWith(theme: ThemePreference) {
  server.use(http.get(`${API}/auth/me`, () => ok({ user: { ...demoUser, theme } })));
  const rendered = renderApp({ route: "/tasks", session: "restoring" });
  await screen.findByRole("combobox", { name: "Theme" });
  return rendered;
}

describe("theme toggle", () => {
  it("applies the theme stored on the session user", async () => {
    await signInWith("dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(toggle()).toHaveValue("dark");
  });

  it("selecting Dark applies the dark theme immediately", async () => {
    const { user } = await signInWith("light");
    await user.selectOptions(toggle(), "dark");
    // No waitFor: the theme must be on the document before the save round trip finishes.
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("selecting Light applies the light theme immediately", async () => {
    const { user } = await signInWith("dark");
    await user.selectOptions(toggle(), "light");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("selecting System follows prefers-color-scheme", async () => {
    osPrefersDark(true);
    const { user } = await signInWith("light");
    expect(document.documentElement).not.toHaveClass("dark");
    await user.selectOptions(toggle(), "system");
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
    await user.selectOptions(toggle(), "dark");
    await waitFor(() => expect(saved).toEqual([{ theme: "dark" }]));
    expect(toggle()).toHaveValue("dark");
  });

  it("shows the API error when saving fails and puts the choice back", async () => {
    const { user } = await signInWith("light");
    server.use(http.patch(`${API}/auth/me`, () => err("INTERNAL", "Could not save your theme")));
    await user.selectOptions(toggle(), "dark");
    expect(await screen.findByText("Could not save your theme")).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement).not.toHaveClass("dark"));
    expect(toggle()).toHaveValue("light");
  });
});
