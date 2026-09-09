import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { authStore } from "@/api/auth-store";
import { AppRoutes } from "@/app/router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { demoUser } from "./msw/fixtures";

export type SessionSetup = "authenticated" | "anonymous" | "restoring";

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

/** Renders the real route tree at `route` with a seeded in-memory session. */
export function renderApp({
  route = "/tasks",
  session = "authenticated",
}: { route?: string; session?: SessionSetup } = {}) {
  if (session === "authenticated") authStore.setSession({ token: "test-token", user: demoUser });
  else if (session === "anonymous") authStore.clear();
  else authStore.reset();
  const queryClient = makeQueryClient();
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
        <LocationProbe />
      </MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );
  return { ...view, user, queryClient };
}
