import type { TaskDetail } from "@/api/models";
import { DismissedSteps } from "./DismissedSteps";
import { StepRow } from "./StepRow";

export function StepList({ task }: { task: TaskDetail }) {
  const visible = task.children.filter((c) => c.suggestionState !== "dismissed");
  const dismissed = task.children.filter((c) => c.suggestionState === "dismissed");
  return (
    <section aria-labelledby="steps-heading" className="space-y-4">
      <h2 id="steps-heading">Steps</h2>
      {visible.length === 0 ? (
        <p className="text-muted-foreground">No steps yet.</p>
      ) : (
        <ol aria-label="Steps" className="space-y-2">
          {visible.map((step) => (
            <StepRow key={step.id} step={step} />
          ))}
        </ol>
      )}
      {dismissed.length > 0 ? <DismissedSteps steps={dismissed} /> : null}
    </section>
  );
}
