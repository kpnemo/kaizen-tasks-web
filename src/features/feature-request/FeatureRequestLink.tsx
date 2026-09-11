import { Sparkles } from "lucide-react";
import { NavButton } from "@/components/nav-button";
import { useFeatureRequestAvailable } from "./hooks";

/** The nav link, present only when the API mounted the route. */
export function FeatureRequestLink() {
  const { available } = useFeatureRequestAvailable();
  if (!available) return null;
  return (
    <NavButton to="/request-feature" icon={Sparkles}>
      Request a feature
    </NavButton>
  );
}
