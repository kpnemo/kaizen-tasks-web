import type { User } from "./models";

export type SessionStatus = "restoring" | "authenticated" | "anonymous";
export type AuthState = { status: SessionStatus; token: string | null; user: User | null };

// Task 10 changes the initial status to "restoring" when AuthProvider starts restoring sessions on load.
const INITIAL: AuthState = { status: "anonymous", token: null, user: null };

let state: AuthState = INITIAL;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** The access token lives here, in module memory, and nowhere else. */
export const authStore = {
  getState(): AuthState {
    return state;
  },
  getToken(): string | null {
    return state.token;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  setSession(session: { token: string; user: User }): void {
    state = { status: "authenticated", token: session.token, user: session.user };
    emit();
  },
  setToken(token: string): void {
    state = { ...state, status: "authenticated", token };
    emit();
  },
  clear(): void {
    state = { status: "anonymous", token: null, user: null };
    emit();
  },
  /** Test helper: back to the initial state. */
  reset(): void {
    state = INITIAL;
    emit();
  },
};
