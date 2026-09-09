import { Navigate, Outlet, useSearchParams } from "react-router";
import { WorkshopFooter } from "@/components/workshop-footer";
import { safeReturnTo } from "@/features/auth/hooks";
import { RestoringScreen } from "@/features/auth/RestoringScreen";
import { useSession } from "@/features/auth/useSession";

/** An already-authenticated visitor to /login or /register goes to the same returnTo RequireAuth set. */
export function PublicOnly() {
  const { status } = useSession();
  const [params] = useSearchParams();
  if (status === "restoring") return <RestoringScreen />;
  if (status === "authenticated") {
    return <Navigate to={safeReturnTo(params.get("returnTo"))} replace />;
  }
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1">
        <Outlet />
      </div>
      <WorkshopFooter />
    </div>
  );
}
