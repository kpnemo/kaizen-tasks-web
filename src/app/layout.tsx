import { ListTodo, LogOut, Tag } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, Outlet } from "react-router";
import { KaizenMark } from "@/components/kaizen-mark";
import { NavButton } from "@/components/nav-button";
import { Button } from "@/components/ui/button";
import { WorkshopFooter } from "@/components/workshop-footer";
import { useLogout } from "@/features/auth/hooks";
import { useSession } from "@/features/auth/useSession";
import { FeatureRequestLink } from "@/features/feature-request/FeatureRequestLink";
import { ThemeToggle } from "@/features/theme/ThemeToggle";

/** The signed-in frame: brand, primary nav, theme control, who is signed in, log out, and the
 *  footer. Renders the matched route in `main`, or `children` when a route mounts the shell itself
 *  (the catch-all, ADR 0009). */
export function AppShell({ children }: { children?: ReactNode }) {
  const { user } = useSession();
  const logout = useLogout();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-4 px-6">
          <NavLink to="/tasks" className="flex items-center gap-2 text-primary" data-nav>
            <KaizenMark />
            <span className="font-display text-2xl font-bold">Kaizen Tasks</span>
          </NavLink>
          <nav aria-label="Primary" className="flex items-center gap-1">
            <NavButton to="/tasks" icon={ListTodo}>
              Tasks
            </NavButton>
            <NavButton to="/tags" icon={Tag}>
              Tags
            </NavButton>
            <FeatureRequestLink />
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <span className="max-w-[12ch] truncate text-base text-muted-foreground">
              {user?.displayName}
            </span>
            <Button variant="outline" onClick={() => logout.mutate()} disabled={logout.isPending}>
              <LogOut aria-hidden="true" />
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children ?? <Outlet />}</main>
      <WorkshopFooter />
    </div>
  );
}
