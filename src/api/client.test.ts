import { http } from "msw";
import { describe, expect, it } from "vitest";
import { demoUser } from "../../tests/msw/fixtures";
import { API, err, ok } from "../../tests/msw/handlers";
import { server } from "../../tests/msw/server";
import { authStore } from "./auth-store";
import { client, unwrap } from "./client";
import { ApiError } from "./errors";

describe("client auth middleware", () => {
  it("attaches the bearer token when one is stored", async () => {
    authStore.setSession({ token: "access-1", user: demoUser });
    let seen = "";
    server.use(
      http.get(`${API}/auth/me`, ({ request }) => {
        seen = request.headers.get("authorization") ?? "";
        return ok({ user: demoUser });
      }),
    );
    await client.GET("/auth/me");
    expect(seen).toBe("Bearer access-1");
  });

  it("on 401 refreshes once and replays the request with the new token", async () => {
    authStore.setSession({ token: "stale", user: demoUser });
    const seen: string[] = [];
    let refreshes = 0;
    server.use(
      http.get(`${API}/auth/me`, ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        seen.push(auth);
        if (auth !== "Bearer fresh") return err("UNAUTHORIZED", "Token expired");
        return ok({ user: demoUser });
      }),
      http.post(`${API}/auth/refresh`, () => {
        refreshes += 1;
        return ok({ accessToken: "fresh" });
      }),
    );
    const result = await client.GET("/auth/me");
    expect(result.response.status).toBe(200);
    expect(result.data?.data.user.email).toBe("demo@kaizen.local");
    expect(refreshes).toBe(1);
    expect(seen).toEqual(["Bearer stale", "Bearer fresh"]);
    expect(authStore.getToken()).toBe("fresh");
  });

  it("clears the session when the refresh itself fails", async () => {
    authStore.setSession({ token: "stale", user: demoUser });
    let refreshes = 0;
    server.use(
      http.get(`${API}/auth/me`, () => err("UNAUTHORIZED", "Token expired")),
      http.post(`${API}/auth/refresh`, () => {
        refreshes += 1;
        return err("UNAUTHORIZED", "No refresh cookie");
      }),
    );
    const result = await client.GET("/auth/me");
    expect(result.response.status).toBe(401);
    expect(refreshes).toBe(1);
    expect(authStore.getState().status).toBe("anonymous");
    expect(authStore.getToken()).toBeNull();
  });

  it("clears the session when the replay is rejected again", async () => {
    authStore.setSession({ token: "stale", user: demoUser });
    let calls = 0;
    server.use(
      http.get(`${API}/auth/me`, () => {
        calls += 1;
        return err("UNAUTHORIZED", "Still no");
      }),
      http.post(`${API}/auth/refresh`, () => ok({ accessToken: "fresh" })),
    );
    const result = await client.GET("/auth/me");
    expect(result.response.status).toBe(401);
    expect(calls).toBe(2);
    expect(authStore.getState().status).toBe("anonymous");
  });

  it("does not refresh for a 401 from an auth route", async () => {
    let refreshes = 0;
    server.use(
      http.post(`${API}/auth/refresh`, () => {
        refreshes += 1;
        return ok({ accessToken: "fresh" });
      }),
    );
    const result = await client.POST("/auth/login", {
      body: { email: "nobody@kaizen.local", password: "wrong-password" },
    });
    expect(result.response.status).toBe(401);
    expect(refreshes).toBe(0);
  });

  it("shares one refresh between concurrent 401s", async () => {
    authStore.setSession({ token: "stale", user: demoUser });
    let refreshes = 0;
    server.use(
      http.get(`${API}/auth/me`, ({ request }) => {
        if (request.headers.get("authorization") !== "Bearer fresh") {
          return err("UNAUTHORIZED", "Token expired");
        }
        return ok({ user: demoUser });
      }),
      http.post(`${API}/auth/refresh`, async () => {
        refreshes += 1;
        await new Promise((r) => setTimeout(r, 20));
        return ok({ accessToken: "fresh" });
      }),
    );
    const [a, b] = await Promise.all([client.GET("/auth/me"), client.GET("/auth/me")]);
    expect(a.response.status).toBe(200);
    expect(b.response.status).toBe(200);
    expect(refreshes).toBe(1);
  });
});

describe("unwrap", () => {
  it("returns the body on success", async () => {
    authStore.setSession({ token: "access-1", user: demoUser });
    const body = unwrap(await client.GET("/auth/me"));
    expect(body.data.user.displayName).toBe("Demo");
  });

  it("throws a decoded ApiError on failure", async () => {
    let thrown: unknown;
    try {
      unwrap(
        await client.POST("/auth/login", {
          body: { email: "nobody@kaizen.local", password: "wrong-password" },
        }),
      );
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).code).toBe("UNAUTHORIZED");
    expect((thrown as ApiError).message).toBe("Invalid email or password");
    expect((thrown as ApiError).requestId).toBe("req-test");
  });
});
