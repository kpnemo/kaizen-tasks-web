import { Workflow } from "lucide-react";
import { NavButton } from "@/components/nav-button";
import { usePipelineAvailable } from "./hooks";

/** The nav link, present only when the API mounted the pipeline routes (ADR 0010). */
export function PipelineLink() {
  const { available } = usePipelineAvailable();
  if (!available) return null;
  return (
    <NavButton to="/pipeline" icon={Workflow}>
      Pipeline
    </NavButton>
  );
}
