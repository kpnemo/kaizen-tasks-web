import { Plus } from "lucide-react";
import { useState } from "react";
import type { TaskDetail } from "@/api/models";
import { useTags } from "@/api/tags-query";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useReplaceTags } from "../hooks";

export function AddTagPopover({ task }: { task: TaskDetail }) {
  const tags = useTags();
  const replaceTags = useReplaceTags();
  const [open, setOpen] = useState(false);
  const current = task.tags.map((t) => t.id);
  const available = (tags.data ?? []).filter((t) => !current.includes(t.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus aria-hidden="true" />
          Add tag
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        {available.length === 0 ? (
          <p className="p-2 text-muted-foreground">
            No more tags to add. Create tags on the Tags page.
          </p>
        ) : (
          <ul aria-label="Available tags" className="space-y-1">
            {available.map((tag) => (
              <li key={tag.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-accent"
                  onClick={() => {
                    replaceTags.mutate({ id: task.id, tagIds: [...current, tag.id] });
                    setOpen(false);
                  }}
                >
                  <span
                    className="size-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                    aria-hidden="true"
                  />
                  {tag.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
