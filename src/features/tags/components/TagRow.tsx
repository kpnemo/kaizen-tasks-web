import { Trash2 } from "lucide-react";
import { useState } from "react";
import type { Tag } from "@/api/models";
import { InlineText } from "@/components/inline-text";
import { TagSwatch } from "@/components/tag-chip";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TableCell, TableRow } from "@/components/ui/table";
import { paletteName } from "@/lib/tag-palette";
import { useDeleteTag, useUpdateTag } from "../hooks";
import { ColorPicker } from "./ColorPicker";

/** One tag as a table row, named by the tag: the swatch button that opens the palette, the palette
 *  colour's name beside it (so hue is never the only signal), the name that edits in place, and
 *  the delete button that confirms first. */
export function TagRow({ tag }: { tag: Tag }) {
  const update = useUpdateTag();
  const remove = useDeleteTag();
  const [colorOpen, setColorOpen] = useState(false);
  return (
    <TableRow aria-label={tag.name}>
      <TableCell>
        <div className="flex items-center gap-3">
          <Popover open={colorOpen} onOpenChange={setColorOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon-lg"
                className="size-11 rounded-full"
                aria-label={`Change color of ${tag.name}`}
              >
                <TagSwatch color={tag.color} className="size-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto">
              <ColorPicker
                value={tag.color}
                aria-label={`Color of ${tag.name}`}
                onChange={(color) => {
                  update.mutate({ id: tag.id, color });
                  setColorOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
          <Badge variant="outline">{paletteName(tag.color)}</Badge>
        </div>
      </TableCell>
      <TableCell className="w-full text-lg font-semibold">
        <InlineText
          label="Tag name"
          value={tag.name}
          onSave={(name) => update.mutate({ id: tag.id, name })}
        />
      </TableCell>
      <TableCell className="w-[1%] text-right">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="icon-lg"
              className="size-11"
              aria-label={`Delete ${tag.name}`}
            >
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
      </TableCell>
    </TableRow>
  );
}
