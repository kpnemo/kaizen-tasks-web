import { Plus, Sparkles } from "lucide-react";
import { isApiError } from "@/api/errors";
import type { TaskDetail } from "@/api/models";
import { useCreateTag, useTags } from "@/api/tags-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { nextPaletteColor } from "@/lib/tag-palette";
import { useReplaceTags } from "../hooks";

/** Tag names proposed by the assistant. Adopting one creates the tag if needed, then replaces the set. */
export function AiTagSuggestions({ task }: { task: TaskDetail }) {
  const tags = useTags();
  const createTag = useCreateTag();
  const replaceTags = useReplaceTags();
  const onTask = new Set(task.tags.map((t) => t.name.toLowerCase()));
  const suggestions = task.aiTagSuggestions.filter((name) => !onTask.has(name.toLowerCase()));
  if (suggestions.length === 0) return null;

  function findByName(name: string, list: { id: string; name: string }[] | undefined) {
    return (list ?? []).find((t) => t.name.toLowerCase() === name.toLowerCase());
  }

  async function adopt(name: string) {
    const known = findByName(name, tags.data);
    let tag = known;
    if (!tag) {
      try {
        tag = await createTag.mutateAsync({ name, color: nextPaletteColor(tags.data ?? []) });
      } catch (error) {
        // Another session may have created the same name first: fall back to it (spec 4.5).
        if (!(isApiError(error) && error.code === "CONFLICT")) throw error;
        const { data } = await tags.refetch();
        tag = findByName(name, data);
        if (!tag) return;
      }
    }
    replaceTags.mutate({ id: task.id, tagIds: [...task.tags.map((t) => t.id), tag.id] });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline">
        <Sparkles aria-hidden="true" />
        Suggested tags
      </Badge>
      {suggestions.map((name) => (
        <Button
          key={name}
          variant="outline"
          aria-label={`Add tag ${name}`}
          disabled={createTag.isPending || replaceTags.isPending}
          onClick={() => void adopt(name).catch(() => undefined)}
        >
          <Plus data-icon="inline-start" aria-hidden="true" />
          {name}
        </Button>
      ))}
    </div>
  );
}
