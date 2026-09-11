import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { NavLink } from "react-router";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** A primary-nav link dressed as a Button. The current screen is the secondary variant, so the
 *  active state is a shape and a weight rather than a tint, and every link carries an icon.
 *  react-router sets `aria-current="page"` on the active link; `data-nav` keeps the 44px hit area
 *  from globals.css. Used by the header and by FeatureRequestLink, so the two never drift. */
export function NavButton({
  icon: Icon,
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof NavLink>, "className" | "children"> & {
  icon: LucideIcon;
  className?: string;
  children: ReactNode;
}) {
  return (
    <NavLink
      data-nav
      className={({ isActive }) =>
        cn(buttonVariants({ variant: isActive ? "secondary" : "ghost" }), className)
      }
      {...props}
    >
      <Icon aria-hidden="true" />
      {children}
    </NavLink>
  );
}
