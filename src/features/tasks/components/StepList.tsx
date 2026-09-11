import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ListChecks } from "lucide-react";
import type { TaskDetail } from "@/api/models";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useReorderStep } from "../hooks";
import { AddStepForm } from "./AddStepForm";
import { DismissedSteps } from "./DismissedSteps";
import { StepRow } from "./StepRow";

export function StepList({ task }: { task: TaskDetail }) {
  const reorder = useReorderStep(task.id);
  const visible = task.children.filter((c) => c.suggestionState !== "dismissed");
  const dismissed = task.children.filter((c) => c.suggestionState === "dismissed");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** The target index is the position of `overId` among all siblings, dismissed included. */
  function moveTo(stepId: string, overId: string) {
    if (stepId === overId) return;
    const position = task.children.findIndex((c) => c.id === overId);
    if (position < 0) return;
    reorder.mutate({ id: stepId, position });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (over) moveTo(String(active.id), String(over.id));
  }

  return (
    <section aria-labelledby="steps-heading" className="flex flex-col gap-4">
      <h2 id="steps-heading">Steps</h2>
      {visible.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListChecks />
            </EmptyMedia>
            <EmptyTitle>No steps yet.</EmptyTitle>
            <EmptyDescription className="text-base">
              Add one below, or ask the assistant to break this task down.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={visible.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ol aria-label="Steps" className="flex flex-col gap-3">
              {visible.map((step, index) => (
                <StepRow
                  key={step.id}
                  step={step}
                  onMoveUp={index > 0 ? () => moveTo(step.id, visible[index - 1]!.id) : undefined}
                  onMoveDown={
                    index < visible.length - 1
                      ? () => moveTo(step.id, visible[index + 1]!.id)
                      : undefined
                  }
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
      {dismissed.length > 0 ? <DismissedSteps steps={dismissed} /> : null}
      <AddStepForm parentId={task.id} />
    </section>
  );
}
