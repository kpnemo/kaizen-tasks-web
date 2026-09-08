import { beforeEach, describe, expect, it, vi } from "vitest";
import { authStore } from "./auth-store";

const user = {
  id: "u-1",
  email: "demo@kaizen.local",
  displayName: "Demo",
  createdAt: "2026-09-01T00:00:00.000Z",
};

describe("authStore", () => {
  beforeEach(() => authStore.reset());

  it("starts anonymous with no token", () => {
    expect(authStore.getState()).toEqual({ status: "anonymous", token: null, user: null });
    expect(authStore.getToken()).toBeNull();
  });

  it("setSession stores the token in memory and notifies subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = authStore.subscribe(listener);
    authStore.setSession({ token: "tok-1", user });
    expect(authStore.getState()).toEqual({ status: "authenticated", token: "tok-1", user });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    authStore.clear();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("setToken replaces the token and keeps the user", () => {
    authStore.setSession({ token: "tok-1", user });
    authStore.setToken("tok-2");
    expect(authStore.getState()).toEqual({ status: "authenticated", token: "tok-2", user });
  });

  it("clear drops everything and reports anonymous", () => {
    authStore.setSession({ token: "tok-1", user });
    authStore.clear();
    expect(authStore.getState()).toEqual({ status: "anonymous", token: null, user: null });
  });

  it("never touches web storage", () => {
    authStore.setSession({ token: "tok-1", user });
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
