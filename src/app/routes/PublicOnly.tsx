import { Navigate, Outlet } from "react-router";
import { useSession } from "@/features/auth/useSession";
import { RestoringScreen } from "./RestoringScreen";

export function PublicOnly() {
  const { status } = useSession();
  if (status === "restoring") return <RestoringScreen />;
  if (status === "authenticated") return <Navigate to="/tasks" replace />;
  return <Outlet />;
}
