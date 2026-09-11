import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useCreateTask } from "../hooks";

export function AddStepForm({ parentId }: { parentId: string }) {
  const create = useCreateTask();
  const [title, setTitle] = useState("");
  return (
    <form
      className="flex gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = title.trim();
        if (!trimmed || create.isPending) return;
        create.mutate({ title: trimmed, parentId }, { onSuccess: () => setTitle("") });
      }}
    >
      <Input
        aria-label="New step"
        placeholder="Add a step"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
      />
      <Button type="submit" variant="outline" disabled={!title.trim() || create.isPending}>
        {create.isPending ? (
          <Spinner data-icon="inline-start" aria-hidden="true" />
        ) : (
          <Plus data-icon="inline-start" aria-hidden="true" />
        )}
        Add step
      </Button>
    </form>
  );
}
