import { useState } from "react";
import { toApiError } from "@/api/errors";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TAG_PALETTE } from "@/lib/tag-palette";
import { ColorPicker } from "./components/ColorPicker";
import { TagRow } from "./components/TagRow";
import { useCreateTag, useTags } from "./hooks";

export function TagsPage() {
  const tags = useTags();
  const create = useCreateTag();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(TAG_PALETTE[0].value);
  const error = create.error ? toApiError(create.error) : null;
  const nameError = error?.code === "CONFLICT" ? error.message : error?.fieldErrors().name;

  return (
    <div className="space-y-8">
      <h1>Tags</h1>
      <form
        aria-label="Create tag"
        className="space-y-5 rounded-xl border bg-card p-5"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = name.trim();
          if (!trimmed || create.isPending) return;
          create.mutate({ name: trimmed, color }, { onSuccess: () => setName("") });
        }}
      >
        <Field id="tag-name" label="Name" error={nameError}>
          <Input
            id="tag-name"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? "tag-name-error" : undefined}
          />
        </Field>
        <div className="space-y-2">
          <p className="text-base font-semibold">Color</p>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <Button type="submit" disabled={!name.trim() || create.isPending}>
          Create tag
        </Button>
      </form>

      {tags.isPending ? (
        <p role="status" className="text-muted-foreground">
          Loading tags
        </p>
      ) : null}
      {tags.isError ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-card p-4">
          Could not load tags: {toApiError(tags.error).message}
        </div>
      ) : null}
      {tags.data ? (
        tags.data.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            No tags yet. Tags connect related tasks.
          </p>
        ) : (
          <table aria-label="Your tags" className="w-full text-left">
            <thead>
              <tr className="border-b text-sm text-muted-foreground">
                <th className="py-2 pr-4 font-semibold">Color</th>
                <th className="py-2 pr-4 font-semibold">Name</th>
                <th className="py-2 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {tags.data.map((tag) => (
                <TagRow key={tag.id} tag={tag} />
              ))}
            </tbody>
          </table>
        )
      ) : null}
    </div>
  );
}
