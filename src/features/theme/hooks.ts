import { useMutation } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import { authStore } from "@/api/auth-store";
import { client, unwrap } from "@/api/client";
import type { ThemePreference } from "@/api/models";
import { toastApiError } from "@/components/api-error-toast";
import { applyTheme, darkMediaQuery, DEFAULT_THEME } from "./theme";

/** The signed-in user's preference, or the default while nobody is signed in. */
export function useThemePreference(): ThemePreference {
  const state = useSyncExternalStore(authStore.subscribe, authStore.getState, authStore.getState);
  return state.user?.theme ?? DEFAULT_THEME;
}

/** Writes the preference onto the document and, while it is `system`, follows the OS as it changes. */
export function useApplyTheme(): void {
  const preference = useThemePreference();
  useEffect(() => {
    applyTheme(preference);
    if (preference !== "system") return;
    const query = darkMediaQuery();
    if (!query) return;
    const onChange = () => applyTheme("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);
}

/** Puts the choice on the session user first, so the page changes at once, then saves it. */
function setLocalTheme(theme: ThemePreference): void {
  const { token, user } = authStore.getState();
  if (token && user) authStore.setSession({ token, user: { ...user, theme } });
}

export function useUpdateTheme() {
  return useMutation<{ theme: ThemePreference }, unknown, ThemePreference, ThemePreference>({
    mutationFn: async (theme) => {
      const { user } = unwrap(await client.PATCH("/auth/me", { body: { theme } })).data;
      return { theme: user.theme };
    },
    onMutate: (theme) => {
      const previous = authStore.getState().user?.theme ?? DEFAULT_THEME;
      setLocalTheme(theme);
      return previous;
    },
    onSuccess: (result) => setLocalTheme(result.theme),
    onError: (error, _theme, previous) => {
      if (previous) setLocalTheme(previous);
      toastApiError(error);
    },
  });
}
