import { X } from "lucide-react";
import type { ComponentProps } from "react";
import type { Tag } from "@/api/models";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** The one place a tag's colour is painted: a dot with a hairline ring, so a pale colour still
 *  reads on both themes. The colour is the user's own hex, so it stays an inline style. */
export function TagSwatch({
  color,
  className,
  ...props
}: { color: string } & Omit<ComponentProps<"span">, "color">) {
  return (
    <span
      data-slot="tag-swatch"
      aria-hidden="true"
      className={cn("inline-block size-3.5 shrink-0 rounded-full ring-1 ring-border", className)}
      style={{ backgroundColor: color }}
      {...props}
    />
  );
}

/** A tag as a chip: its swatch and name, and, where the caller allows it, a square remove button
 *  named after the tag ("Remove tag work"), which the task tests query by that name. */
export function TagChip({ tag, onRemove }: { tag: Tag; onRemove?: () => void }) {
  return (
    <Badge variant="outline" className={cn("gap-2", onRemove && "pr-1")}>
      <TagSwatch color={tag.color} />
      {tag.name}
      {onRemove ? (
        <Button
          variant="ghost"
          size="icon-lg"
          className="size-11 rounded-full"
          aria-label={`Remove tag ${tag.name}`}
          onClick={onRemove}
        >
          <X aria-hidden="true" />
        </Button>
      ) : null}
    </Badge>
  );
}
