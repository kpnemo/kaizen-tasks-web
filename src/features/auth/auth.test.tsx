import { screen, waitFor } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import { authStore } from "@/api/auth-store";
import { API, DEMO_PASSWORD, err, ok } from "../../../tests/msw/handlers";
import { server } from "../../../tests/msw/server";
import { renderApp } from "../../../tests/render";

describe("login", () => {
  it("logs in and lands on the task list", async () => {
    const { user } = renderApp({ route: "/login", session: "anonymous" });
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Email"), "demo@kaizen.local");
    await user.type(screen.getByLabelText("Password"), DEMO_PASSWORD);
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("heading", { name: "Tasks" })).toBeInTheDocument();
    expect(screen.getByText("Demo")).toBeInTheDocument();
    expect(authStore.getToken()).toBe("access-1");
    // ADR 0003 still holds for the access token: nothing lands in `localStorage` but the harmless
    // per-device theme cache `useApplyTheme` writes on every mount (ADR 0006).
    expect(Object.keys(localStorage)).toEqual(["kaizen.theme"]);
  });

  it("honors a same-origin returnTo", async () => {
    const { user } = renderApp({ route: "/login?returnTo=%2Ftags", session: "anonymous" });
    await user.type(screen.getByLabelText("Email"), "demo@kaizen.local");
    await user.type(screen.getByLabelText("Password"), DEMO_PASSWORD);
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("heading", { name: "Tags" })).toBeInTheDocument();
  });

  it("shows the API message for a wrong password and stays on the page", async () => {
    const { user } = renderApp({ route: "/login", session: "anonymous" });
    await user.type(screen.getByLabelText("Email"), "demo@kaizen.local");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    // One Alert: a title that names what failed, the API message, and an icon so red is not the
    // only signal.
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not log in");
    expect(alert).toHaveTextContent("Invalid email or password");
    expect(alert.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(authStore.getToken()).toBeNull();
  });

  it("opens with the email field focused, an iconed submit, and a link to registration", () => {
    renderApp({ route: "/login", session: "anonymous" });
    // A real h1 inside CardTitle, not CardTitle rendered as the h1: card.tsx has no asChild (the
    // Surfaces rule in docs/ui-conventions.md), so the heading keeps the page-heading type
    // globals.css gives every h1 and CardTitle only places it.
    const heading = screen.getByRole("heading", { name: "Log in", level: 1 });
    expect(heading.parentElement).toHaveAttribute("data-slot", "card-title");
    expect(screen.getByLabelText("Email")).toHaveFocus();
    expect(screen.getByRole("button", { name: "Log in" }).querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    const link = screen.getByRole("link", { name: "Create an account" });
    expect(link).toHaveAttribute("href", "/register");
    // The link is a Button in link clothes, not a hand-styled anchor, so it shares the app's focus
    // ring and hit area; asChild keeps it an anchor for the selector contract.
    expect(link).toHaveAttribute("data-slot", "button");
  });
});

describe("register", () => {
  it("creates the account and lands on the task list", async () => {
    const { user } = renderApp({ route: "/register", session: "anonymous" });
    await user.type(screen.getByLabelText("Email"), "smoke@kaizen.local");
    await user.type(screen.getByLabelText("Password"), "smoke-password-1");
    await user.type(screen.getByLabelText("Display name"), "Smoke");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("heading", { name: "Tasks" })).toBeInTheDocument();
    expect(screen.getByText("Smoke")).toBeInTheDocument();
    expect(authStore.getToken()).toBe("access-new");
  });

  it("shows a duplicate email as a field error", async () => {
    const { user } = renderApp({ route: "/register", session: "anonymous" });
    await user.type(screen.getByLabelText("Email"), "demo@kaizen.local");
    await user.type(screen.getByLabelText("Password"), "smoke-password-1");
    await user.type(screen.getByLabelText("Display name"), "Smoke");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "An account with this email already exists",
    );
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
  });

  it("maps VALIDATION_ERROR details onto the fields", async () => {
    server.use(
      http.post(`${API}/auth/register`, () =>
        err("VALIDATION_ERROR", "Invalid request", [
          { path: "body.password", message: "Password must be at least 8 characters" },
        ]),
      ),
    );
    const { user } = renderApp({ route: "/register", session: "anonymous" });
    await user.type(screen.getByLabelText("Email"), "smoke@kaizen.local");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.type(screen.getByLabelText("Display name"), "Smoke");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Password must be at least 8 characters",
    );
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("aria-invalid", "true");
    // The rule the user just broke stays on screen beside the error, and the control is described
    // by both, hint first; the field wrapper owns the wiring, the page spells no id itself.
    expect(screen.getByText("At least 8 characters")).toBeVisible();
    expect(password).toHaveAttribute("aria-describedby", "password-hint password-error");
  });

  it("shows an error that belongs to no field as an alert, with no field marked invalid", async () => {
    server.use(http.post(`${API}/auth/register`, () => err("INTERNAL", "Database unavailable")));
    const { user } = renderApp({ route: "/register", session: "anonymous" });
    await user.type(screen.getByLabelText("Email"), "smoke@kaizen.local");
    await user.type(screen.getByLabelText("Password"), "smoke-password-1");
    await user.type(screen.getByLabelText("Display name"), "Smoke");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not create your account");
    expect(alert).toHaveTextContent("Database unavailable");
    expect(alert.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
  });

  it("opens with the email field focused and links back to login", () => {
    renderApp({ route: "/register", session: "anonymous" });
    const heading = screen.getByRole("heading", { name: "Create your account", level: 1 });
    expect(heading.parentElement).toHaveAttribute("data-slot", "card-title");
    expect(screen.getByLabelText("Email")).toHaveFocus();
    expect(
      screen.getByRole("button", { name: "Create account" }).querySelector("svg"),
    ).toHaveAttribute("aria-hidden", "true");
    const link = screen.getByRole("link", { name: "Log in" });
    expect(link).toHaveAttribute("href", "/login");
    expect(link).toHaveAttribute("data-slot", "button");
  });
});

describe("session restore", () => {
  it("refreshes once on load and shows the user without a login flash", async () => {
    let refreshes = 0;
    server.use(
      http.post(`${API}/auth/refresh`, () => {
        refreshes += 1;
        return ok({ accessToken: "access-restored" });
      }),
    );
    renderApp({ route: "/tasks", session: "restoring" });
    const status = screen.getByRole("status", { name: "Session" });
    expect(status).toHaveTextContent("Restoring your session");
    // A spinner beside the sentence, hidden from the name so the status is still "Session".
    expect(status.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("status", { name: "Loading" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Log in" })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Tasks" })).toBeInTheDocument();
    expect(screen.getByText("Demo")).toBeInTheDocument();
    expect(refreshes).toBe(1);
    expect(authStore.getToken()).toBe("access-restored");
  });

  it("lands on login silently when the refresh fails", async () => {
    server.use(http.post(`${API}/auth/refresh`, () => err("UNAUTHORIZED", "No refresh cookie")));
    renderApp({ route: "/tasks", session: "restoring" });
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(document.querySelector("[data-sonner-toast]")).toBeNull();
  });
});

describe("logout", () => {
  it("calls the API, clears the store and the cache, and shows the login page", async () => {
    let logouts = 0;
    server.use(
      http.post(`${API}/auth/logout`, () => {
        logouts += 1;
        return new Response(null, { status: 204 });
      }),
    );
    const { user, queryClient } = renderApp({ route: "/tags" });
    await user.click(await screen.findByRole("button", { name: "Log out" }));
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    await waitFor(() => expect(logouts).toBe(1));
    expect(authStore.getState()).toEqual({ status: "anonymous", token: null, user: null });
    // The mutation's onSettled clears the whole cache; the login page's footer then mounts and
    // re-issues the shared (session-less) health query, so that is the only query left standing.
    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .map((q) => q.queryKey),
    ).toEqual([["health"]]);
  });
});
