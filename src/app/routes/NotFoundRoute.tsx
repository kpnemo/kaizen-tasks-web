import { WorkshopFooter } from "@/components/workshop-footer";
import { RestoringScreen } from "@/features/auth/RestoringScreen";
import { useSession } from "@/features/auth/useSession";
import { AppShell } from "../layout";
import { NotFoundPage } from "./NotFoundPage";

/** The catch-all. A signed-in user sees the 404 inside the shell (header, nav, theme control,
 *  footer, and a way back); a visitor who is not signed in sees it in a bare frame with the
 *  footer, without being asked to log in to a page that does not exist. One route decides by
 *  session, because a splat inside the shell and a splat outside it tie on rank, so whichever was
 *  declared first would answer for both audiences (ADR 0009). */
export function NotFoundRoute() {
  const { status } = useSession();
  if (status === "restoring") return <RestoringScreen />;
  if (status === "authenticated") {
    return (
      <AppShell>
        <NotFoundPage />
      </AppShell>
    );
  }
  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <NotFoundPage />
      </main>
      <WorkshopFooter />
    </div>
  );
}
