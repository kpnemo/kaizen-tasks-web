import { ListTodo, Tag } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, Outlet } from "react-router";
import { KaizenMark } from "@/components/kaizen-mark";
import { NavButton } from "@/components/nav-button";
import { WorkshopFooter } from "@/components/workshop-footer";
import { AccountMenu } from "@/features/auth/AccountMenu";
import { useSession } from "@/features/auth/useSession";
import { useFeatureRequestAvailable } from "@/features/feature-request/hooks";
import { usePipelineAvailable } from "@/features/pipeline/hooks";
import { ThemeToggle } from "@/features/theme/ThemeToggle";

/** The signed-in frame: brand, primary nav, the theme control, and the account menu (Feature
 *  Request, Pipeline, and Log out, behind the display name). Renders the matched route in `main`,
 *  or `children` when a route mounts the shell itself (the catch-all, ADR 0009). `src/app/` may
 *  import any feature, so the two availability flags are read here and passed down —
 *  `AccountMenu` itself stays inside `features/auth/` and never imports another feature. */
export function AppShell({ children }: { children?: ReactNode }) {
  const { user } = useSession();
  const { available: featureRequestAvailable } = useFeatureRequestAvailable();
  const { available: pipelineAvailable } = usePipelineAvailable();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-4 px-6">
          <NavLink to="/tasks" className="flex items-center gap-2 text-primary" data-nav>
            <KaizenMark />
            <span className="font-display text-2xl font-bold whitespace-nowrap">Kaizen Tasks</span>
          </NavLink>
          <nav aria-label="Primary" className="flex items-center gap-1">
            <NavButton to="/tasks" icon={ListTodo}>
              Tasks
            </NavButton>
            <NavButton to="/tags" icon={Tag}>
              Tags
            </NavButton>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <AccountMenu
              displayName={user?.displayName ?? ""}
              featureRequestAvailable={featureRequestAvailable}
              pipelineAvailable={pipelineAvailable}
            />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children ?? <Outlet />}</main>
      <WorkshopFooter />
    </div>
  );
}
