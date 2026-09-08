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
    expect(localStorage.length).toBe(0);
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
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(authStore.getToken()).toBeNull();
  });

  it("links to registration", () => {
    renderApp({ route: "/login", session: "anonymous" });
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/register",
    );
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
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
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
    expect(screen.getByRole("status", { name: "Session" })).toHaveTextContent(
      "Restoring your session",
    );
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
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
