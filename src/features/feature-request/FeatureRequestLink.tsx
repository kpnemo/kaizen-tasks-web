import { NavLink } from "react-router";
import { cn } from "@/lib/cn";
import { useFeatureRequestAvailable } from "./hooks";

/** The nav link, present only when the API mounted the route. */
export function FeatureRequestLink() {
  const { available } = useFeatureRequestAvailable();
  if (!available) return null;
  return (
    <NavLink
      to="/request-feature"
      data-nav
      className={({ isActive }) =>
        cn(
          "inline-flex items-center rounded-md px-3 text-base font-semibold text-foreground/80 hover:text-foreground",
          isActive && "bg-accent text-accent-foreground",
        )
      }
    >
      Request a feature
    </NavLink>
  );
}
