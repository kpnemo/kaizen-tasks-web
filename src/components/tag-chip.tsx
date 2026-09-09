import { X } from "lucide-react";
import type { Tag } from "@/api/models";
import { cn } from "@/lib/cn";

export function TagChip({ tag, onRemove }: { tag: Tag; onRemove?: () => void }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm font-semibold",
        onRemove && "pr-1",
      )}
    >
      <span
        className="size-3 rounded-full"
        style={{ backgroundColor: tag.color }}
        aria-hidden="true"
      />
      {tag.name}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove tag ${tag.name}`}
          className="grid size-9 place-items-center rounded-full hover:bg-accent"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}
