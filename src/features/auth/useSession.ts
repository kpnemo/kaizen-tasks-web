import { useSyncExternalStore } from "react";
import { authStore, type AuthState } from "@/api/auth-store";

/** Re-renders when the in-memory session changes. */
export function useSession(): AuthState {
  return useSyncExternalStore(authStore.subscribe, authStore.getState, authStore.getState);
}
