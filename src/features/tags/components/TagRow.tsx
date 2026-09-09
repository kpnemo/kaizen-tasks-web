import { Trash2 } from "lucide-react";
import { useState } from "react";
import type { Tag } from "@/api/models";
import { InlineText } from "@/components/inline-text";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDeleteTag, useUpdateTag } from "../hooks";
import { ColorPicker } from "./ColorPicker";

export function TagRow({ tag }: { tag: Tag }) {
  const update = useUpdateTag();
  const remove = useDeleteTag();
  const [colorOpen, setColorOpen] = useState(false);
  const nameId = `tag-${tag.id}-name`;
  return (
    <tr aria-labelledby={nameId} className="border-b">
      <td className="py-2 pr-4">
        <Popover open={colorOpen} onOpenChange={setColorOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Change color of ${tag.name}`}
              className="size-11 rounded-full border-4 border-card shadow"
              style={{ backgroundColor: tag.color }}
            />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto">
            <ColorPicker
              value={tag.color}
              label={`Color of ${tag.name}`}
              onChange={(color) => {
                update.mutate({ id: tag.id, color });
                setColorOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </td>
      <td id={nameId} className="w-full py-2 pr-4 text-lg font-semibold">
        <InlineText
          label="Tag name"
          value={tag.name}
          onSave={(name) => update.mutate({ id: tag.id, name })}
        />
      </td>
      <td className="py-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Delete ${tag.name}`}>
              <Trash2 aria-hidden="true" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete the tag "{tag.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                The tag is removed from every task that has it. The tasks themselves stay.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep tag</AlertDialogCancel>
              <AlertDialogAction onClick={() => remove.mutate(tag.id)}>
                Delete tag
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </td>
    </tr>
  );
}
