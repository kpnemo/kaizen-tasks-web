import { Plus } from "lucide-react";
import { useState } from "react";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTask } from "../hooks";

/** The create bar: a form around a Card (the installed Card is a div with no `asChild`) whose
 *  content is the labelled title field with its hint and, once "Add description" reveals it, the
 *  description field; the actions sit in the footer. Enter in the title submits the form. The
 *  names the smoke test uses ("Task title", "Description", "Add description", "Add task") come
 *  from the visible labels and buttons. */
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
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Card>
        <CardContent>
          <FieldGroup className="gap-4">
            <Field
              id="task-title"
              label="Task title"
              hint="A sentence or two of context helps the assistant"
            >
              <Input
                id="task-title"
                placeholder="What do you want to get done?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
              />
            </Field>
            {showDescription ? (
              <Field id="task-description" label="Description">
                <Textarea
                  id="task-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={4000}
                  rows={3}
                />
              </Field>
            ) : null}
          </FieldGroup>
        </CardContent>
        <CardFooter className="gap-3">
          {showDescription ? null : (
            <Button type="button" variant="outline" onClick={() => setShowDescription(true)}>
              <Plus data-icon="inline-start" aria-hidden="true" />
              Add description
            </Button>
          )}
          <Button type="submit" className="ml-auto" disabled={create.isPending || !title.trim()}>
            {create.isPending ? (
              <Spinner data-icon="inline-start" aria-hidden="true" />
            ) : (
              <Plus data-icon="inline-start" aria-hidden="true" />
            )}
            Add task
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
