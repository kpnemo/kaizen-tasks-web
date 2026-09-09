import { useEffect, type ReactNode } from "react";
import { authStore } from "@/api/auth-store";
import { client, refreshAccessToken } from "@/api/client";
import { RestoringScreen } from "./RestoringScreen";
import { useSession } from "./useSession";

/**
 * Restores the session once on load: refresh the access token from the httpOnly cookie, then load
 * the user. While it runs the shell shows a neutral screen, so a returning user never sees a login
 * flash. A failed refresh means logged out, silently.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();

  useEffect(() => {
    if (authStore.getState().status !== "restoring") return;
    let cancelled = false;
    void (async () => {
      const token = await refreshAccessToken();
      if (cancelled) return;
      if (!token) {
        authStore.clear();
        return;
      }
      authStore.setToken(token);
      const me = await client.GET("/auth/me");
      if (cancelled) return;
      if (me.data) {
        authStore.setSession({ token: authStore.getToken() ?? token, user: me.data.data.user });
      } else {
        authStore.clear();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "restoring") return <RestoringScreen />;
  return <>{children}</>;
}
