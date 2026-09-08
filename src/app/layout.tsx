import { LogOut } from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { KaizenMark } from "@/components/kaizen-mark";
import { Button } from "@/components/ui/button";
import { useLogout } from "@/features/auth/hooks";
import { useSession } from "@/features/auth/useSession";
import { cn } from "@/lib/cn";

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    "inline-flex items-center rounded-md px-3 text-base font-semibold text-foreground/80 hover:text-foreground",
    isActive && "bg-accent text-accent-foreground",
  );
}

/** Stub until Task 17 replaces it with the link gated on the health feature flag. */
export function FeatureRequestLink() {
  return null;
}

export function AppShell() {
  const { user } = useSession();
  const logout = useLogout();
  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-6 px-6">
          <NavLink to="/tasks" className="flex items-center gap-2 text-primary" data-nav>
            <KaizenMark />
            <span className="font-display text-2xl font-bold">Kaizen Tasks</span>
          </NavLink>
          <nav aria-label="Primary" className="flex items-center gap-1">
            <NavLink to="/tasks" className={navLinkClass} data-nav>
              Tasks
            </NavLink>
            <NavLink to="/tags" className={navLinkClass} data-nav>
              Tags
            </NavLink>
            <FeatureRequestLink />
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-base text-muted-foreground">{user?.displayName}</span>
            <Button variant="outline" onClick={() => logout.mutate()} disabled={logout.isPending}>
              <LogOut aria-hidden="true" />
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
