import { Progress } from "@/components/ui/progress";

/** Steps done over steps counted: a Progress that says it in words for the screen reader, beside
 *  the `done/total` text the detail contract pins (for example `0/1`). A task with no counted
 *  steps yet, the fresh one the demo creates live, shows nothing rather than an empty bar and 0/0. */
export function ProgressBar({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  const percent = Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-3">
      <Progress
        value={percent}
        className="h-3 w-32"
        aria-label="Steps done"
        aria-valuetext={`${done} of ${total} steps done`}
      />
      <span className="text-base font-semibold tabular-nums text-muted-foreground">
        {done}/{total}
      </span>
    </div>
  );
}
