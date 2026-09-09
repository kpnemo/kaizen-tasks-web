import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router";
import { authStore } from "@/api/auth-store";
import { client, unwrap } from "@/api/client";
import type { AuthSession, LoginBody, RegisterBody } from "@/api/models";

/** Only same-origin paths are honored as a return target; anything else goes to /tasks. */
export function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/tasks";
  return value;
}

function useEnterSession() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return (session: AuthSession) => {
    authStore.setSession({ token: session.accessToken, user: session.user });
    navigate(safeReturnTo(params.get("returnTo")), { replace: true });
  };
}

export function useLogin() {
  const enter = useEnterSession();
  return useMutation({
    mutationFn: async (body: LoginBody) => unwrap(await client.POST("/auth/login", { body })).data,
    onSuccess: enter,
  });
}

export function useRegister() {
  const enter = useEnterSession();
  return useMutation({
    mutationFn: async (body: RegisterBody) =>
      unwrap(await client.POST("/auth/register", { body })).data,
    onSuccess: enter,
  });
}

/** Logout always ends the local session, even when the API call fails. */
export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async () => {
      await client.POST("/auth/logout");
    },
    onSettled: () => {
      authStore.clear();
      queryClient.clear();
      navigate("/login", { replace: true });
    },
  });
}
