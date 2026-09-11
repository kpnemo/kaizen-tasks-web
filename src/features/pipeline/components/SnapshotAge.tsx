import { CircleX, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/format";

/** When the snapshot was built, printed once under the environment cards: in the brand colour while
 *  it is fresh, and in the destructive colour with "GitHub unreachable" and the API's reason when the
 *  API is serving its last-good copy (spec "The page", block 2). The room reads this line as proof
 *  the numbers above and below it are live. */
export function SnapshotAge({
  generatedAt,
  stale,
  staleReason,
}: {
  generatedAt: string;
  stale: boolean;
  staleReason?: string;
}) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 font-medium",
          stale ? "text-destructive" : "text-primary",
        )}
      >
        <Clock aria-hidden="true" className="size-4" />
        as of {formatClock(generatedAt, "seconds")}
      </span>
      {stale && (
        <Badge variant="destructive">
          <CircleX aria-hidden="true" />
          GitHub unreachable
        </Badge>
      )}
      {stale && staleReason && <span className="text-muted-foreground">{staleReason}</span>}
    </p>
  );
}
