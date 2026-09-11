import {
  Check,
  Circle,
  CircleCheck,
  CircleDashed,
  ListFilter,
  type LucideIcon,
} from "lucide-react";
import { useEffect } from "react";
import type { TaskStatus } from "@/api/models";
import { useTags } from "@/api/tags-query";
import { toastApiError } from "@/components/api-error-toast";
import { TagSwatch } from "@/components/tag-chip";
import { Button } from "@/components/ui/button";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import type { TaskFilters } from "../hooks";

const STATUSES: { value: TaskStatus | undefined; label: string; icon: LucideIcon }[] = [
  { value: undefined, label: "All", icon: ListFilter },
  { value: "todo", label: "To do", icon: Circle },
  { value: "in_progress", label: "In progress", icon: CircleDashed },
  { value: "done", label: "Done", icon: CircleCheck },
];

/** Two named groups of pressed buttons (ui-conventions: a mode switch of 2 to 4 choices is a
 *  group of `Button`s with `aria-pressed` and an icon each; the smoke and unit tests query them
 *  by name and pressed state, which a ToggleGroup's radio roles would break). Each is a fieldset
 *  whose visible legend names it; the choices sit in a plain flex row rather than a `FieldGroup`,
 *  whose container query (`container-type: inline-size`) gives a content-sized fieldset no width
 *  and stacks the buttons in a column. The tag group holds its place with two skeleton pills
 *  while the tags load, toasts once if they cannot, and stays away when the account has no tags. */
export function FilterBar({
  filters,
  onChange,
}: {
  filters: TaskFilters;
  onChange: (next: TaskFilters) => void;
}) {
  const tags = useTags();
  useEffect(() => {
    if (tags.isError) toastApiError(tags.error);
  }, [tags.isError, tags.error]);
  const showTags = tags.isPending || (tags.data !== undefined && tags.data.length > 0);

  return (
    <div className="flex flex-wrap items-start gap-6">
      <FieldSet>
        <FieldLegend variant="legend">Status</FieldLegend>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map(({ value, label, icon: Icon }) => {
            const pressed = filters.status === value;
            return (
              <Button
                key={label}
                type="button"
                variant={pressed ? "default" : "outline"}
                aria-pressed={pressed}
                onClick={() => onChange({ ...filters, status: value })}
              >
                <Icon data-icon="inline-start" aria-hidden="true" />
                {label}
              </Button>
            );
          })}
        </div>
      </FieldSet>
      {showTags ? (
        <FieldSet>
          <FieldLegend variant="legend">Tag</FieldLegend>
          <div className="flex flex-wrap gap-2">
            {tags.isPending ? (
              <>
                <Skeleton className="h-11 w-24 rounded-md" />
                <Skeleton className="h-11 w-24 rounded-md" />
              </>
            ) : (
              tags.data?.map((tag) => {
                const pressed = filters.tagId === tag.id;
                return (
                  <Button
                    key={tag.id}
                    type="button"
                    variant={pressed ? "default" : "outline"}
                    aria-pressed={pressed}
                    onClick={() => onChange({ ...filters, tagId: pressed ? undefined : tag.id })}
                  >
                    {pressed ? <Check data-icon="inline-start" aria-hidden="true" /> : null}
                    <TagSwatch color={tag.color} />
                    {tag.name}
                  </Button>
                );
              })
            )}
          </div>
        </FieldSet>
      ) : null}
    </div>
  );
}
