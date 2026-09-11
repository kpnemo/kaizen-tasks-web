import { ChevronDown, LogOut, Sparkles, Workflow } from "lucide-react";
import { NavLink } from "react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLogout } from "./hooks";

/** The account menu: the display name opens Feature Request, Pipeline (each only when the caller
 *  says the API mounted its routes — a feature never imports another feature, so `layout.tsx`
 *  reads those flags and passes them down) and Log out. The trigger's accessible name is the
 *  display name alone (the chevron is `aria-hidden`); Log out keeps the accessible name "Log out"
 *  the smoke test relies on (`README.md`, "Selector contract") — now a menu item rather than a
 *  header button. */
export function AccountMenu({
  displayName,
  featureRequestAvailable,
  pipelineAvailable,
}: {
  displayName: string;
  featureRequestAvailable: boolean | undefined;
  pipelineAvailable: boolean | undefined;
}) {
  const logout = useLogout();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={logout.isPending}>
          <span className="max-w-[12ch] truncate">{displayName}</span>
          <ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {featureRequestAvailable && (
          <DropdownMenuItem asChild>
            <NavLink to="/request-feature">
              <Sparkles aria-hidden="true" />
              Request a feature
            </NavLink>
          </DropdownMenuItem>
        )}
        {pipelineAvailable && (
          <DropdownMenuItem asChild>
            <NavLink to="/pipeline">
              <Workflow aria-hidden="true" />
              Pipeline
            </NavLink>
          </DropdownMenuItem>
        )}
        {(featureRequestAvailable || pipelineAvailable) && <DropdownMenuSeparator />}
        <DropdownMenuItem onSelect={() => logout.mutate()} disabled={logout.isPending}>
          <LogOut aria-hidden="true" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
