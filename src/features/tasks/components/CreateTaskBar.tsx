import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTask } from "../hooks";

export function CreateTaskBar() {
  const create = useCreateTask();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [showDescription, setShowDescription] = useState(false);

  function submit() {
    const trimmed = title.trim();
    if (!trimmed || create.isPending) return;
    create.mutate(
      { title: trimmed, description: description.trim() || undefined },
      {
        onSuccess: () => {
          setTitle("");
          setDescription("");
          setShowDescription(false);
        },
      },
    );
  }

  return (
    <form
      className="space-y-3 rounded-xl border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex gap-3">
        <Input
          aria-label="Task title"
          placeholder="What do you want to get done?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-lg"
          maxLength={200}
        />
        <Button type="submit" disabled={create.isPending || !title.trim()}>
          Add task
        </Button>
      </div>
      {showDescription ? (
        <Textarea
          aria-label="Description"
          placeholder="A sentence or two of context helps the assistant"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={4000}
          rows={3}
        />
      ) : (
        <Button type="button" variant="ghost" onClick={() => setShowDescription(true)}>
          Add description
        </Button>
      )}
    </form>
  );
}
