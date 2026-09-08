import { Navigate, Outlet, useLocation } from "react-router";
import { useSession } from "@/features/auth/useSession";
import { RestoringScreen } from "./RestoringScreen";

export function RequireAuth() {
  const { status } = useSession();
  const location = useLocation();
  if (status === "restoring") return <RestoringScreen />;
  if (status === "anonymous") {
    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }
  return <Outlet />;
}
