import { Plus } from "lucide-react";
import type { TaskDetail } from "@/api/models";
import { useTags } from "@/api/tags-query";
import { TagSwatch } from "@/components/tag-chip";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useReplaceTags } from "../hooks";

/** "Add tag": a menu of the tags not yet on the task, each with its swatch; picking one replaces
 *  the task's tag set. A `dropdown-menu` rather than the popover list it started as, so the
 *  choices get arrow keys, Escape and a focus ring for free (the file keeps its historical name). */
export function AddTagPopover({ task }: { task: TaskDetail }) {
  const tags = useTags();
  const replaceTags = useReplaceTags();
  const current = task.tags.map((t) => t.id);
  const available = (tags.data ?? []).filter((t) => !current.includes(t.id));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Plus data-icon="inline-start" aria-hidden="true" />
          Add tag
        </Button>
      </DropdownMenuTrigger>
      {/* Radix names a menu after its trigger ("Add tag"); this list has a name of its own. */}
      <DropdownMenuContent align="start" aria-label="Available tags" aria-labelledby={undefined}>
        {available.length === 0 ? (
          <DropdownMenuLabel className="max-w-64 text-base whitespace-normal">
            No more tags to add. Create tags on the Tags page.
          </DropdownMenuLabel>
        ) : (
          <DropdownMenuGroup>
            {available.map((tag) => (
              <DropdownMenuItem
                key={tag.id}
                className="min-h-11 text-base"
                onSelect={() => replaceTags.mutate({ id: task.id, tagIds: [...current, tag.id] })}
              >
                <TagSwatch color={tag.color} />
                {tag.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
