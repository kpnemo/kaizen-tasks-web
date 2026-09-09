import type { TaskStatus } from "@/api/models";
import { useTags } from "@/api/tags-query";
import { Button } from "@/components/ui/button";
import type { TaskFilters } from "../hooks";

const STATUSES: { value: TaskStatus | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

export function FilterBar({
  filters,
  onChange,
}: {
  filters: TaskFilters;
  onChange: (next: TaskFilters) => void;
}) {
  const tags = useTags();
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div role="group" aria-label="Status" className="flex rounded-lg border bg-card p-1">
        {STATUSES.map((s) => (
          <Button
            key={s.label}
            type="button"
            variant={filters.status === s.value ? "default" : "ghost"}
            aria-pressed={filters.status === s.value}
            onClick={() => onChange({ ...filters, status: s.value })}
          >
            {s.label}
          </Button>
        ))}
      </div>
      {tags.data && tags.data.length > 0 ? (
        <div role="group" aria-label="Tag" className="flex flex-wrap gap-2">
          {tags.data.map((tag) => (
            <Button
              key={tag.id}
              type="button"
              variant={filters.tagId === tag.id ? "default" : "outline"}
              aria-pressed={filters.tagId === tag.id}
              onClick={() =>
                onChange({ ...filters, tagId: filters.tagId === tag.id ? undefined : tag.id })
              }
            >
              <span
                className="size-3 rounded-full"
                style={{ backgroundColor: tag.color }}
                aria-hidden="true"
              />
              {tag.name}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
