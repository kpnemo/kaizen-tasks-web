import { CircleAlert, Plus, RefreshCw, TagIcon } from "lucide-react";
import { useState } from "react";
import { toApiError } from "@/api/errors";
import { Field } from "@/components/field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { nextPaletteColor } from "@/lib/tag-palette";
import { ColorPicker } from "./components/ColorPicker";
import { TagRow } from "./components/TagRow";
import { useCreateTag, useTags } from "./hooks";

const COLOR_LEGEND_ID = "tag-color-legend";

export function TagsPage() {
  const tags = useTags();
  const create = useCreateTag();
  const [name, setName] = useState("");
  // null means "no manual pick yet": the picker shows the next unused palette color, recomputed
  // from the currently loaded tags on every render (falls back to the first palette color before
  // tags load). Reset to null after a successful create so the next tag again defaults this way.
  const [manualColor, setManualColor] = useState<string | null>(null);
  const color = manualColor ?? nextPaletteColor(tags.data ?? []);
  const error = create.error ? toApiError(create.error) : null;
  const nameError = error?.code === "CONFLICT" ? error.message : error?.fieldErrors().name;

  return (
    <div className="flex flex-col gap-8">
      <h1>Tags</h1>
      <form
        aria-label="Create tag"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = name.trim();
          if (!trimmed || create.isPending) return;
          create.mutate(
            { name: trimmed, color },
            {
              onSuccess: () => {
                setName("");
                setManualColor(null);
              },
            },
          );
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>New tag</CardTitle>
            <CardDescription>
              A name and a palette color. Tags connect related tasks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field id="tag-name" label="Name" error={nameError}>
                <Input
                  id="tag-name"
                  value={name}
                  maxLength={40}
                  autoComplete="off"
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={Boolean(nameError)}
                />
              </Field>
              <FieldSet>
                <FieldLegend id={COLOR_LEGEND_ID}>Color</FieldLegend>
                <FieldGroup>
                  <ColorPicker
                    value={color}
                    onChange={setManualColor}
                    aria-labelledby={COLOR_LEGEND_ID}
                  />
                </FieldGroup>
              </FieldSet>
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              {create.isPending ? (
                <Spinner data-icon="inline-start" aria-hidden="true" />
              ) : (
                <Plus data-icon="inline-start" aria-hidden="true" />
              )}
              Create tag
            </Button>
          </CardFooter>
        </Card>
      </form>

      {tags.isPending ? (
        <TagsLoading />
      ) : tags.isError ? (
        <div className="flex flex-col items-start gap-3">
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Could not load tags</AlertTitle>
            <AlertDescription>{toApiError(tags.error).message}</AlertDescription>
          </Alert>
          <Button variant="outline" onClick={() => void tags.refetch()} disabled={tags.isFetching}>
            {tags.isFetching ? (
              <Spinner data-icon="inline-start" aria-hidden="true" />
            ) : (
              <RefreshCw data-icon="inline-start" aria-hidden="true" />
            )}
            Try again
          </Button>
        </div>
      ) : tags.data.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TagIcon />
            </EmptyMedia>
            <EmptyTitle>No tags</EmptyTitle>
            <EmptyDescription>No tags yet. Tags connect related tasks.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table aria-label="Your tags">
          <TagsTableHeader />
          <TableBody>
            {tags.data.map((tag) => (
              <TagRow key={tag.id} tag={tag} />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

/** The header the real table and its loading placeholder share, so the swap moves nothing. */
function TagsTableHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead className="font-semibold">Color</TableHead>
        <TableHead className="w-full font-semibold">Name</TableHead>
        <TableHead className="font-semibold">
          <span className="sr-only">Actions</span>
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}

/** Three rows in the table's shape while the tags load. The placeholder table is hidden from
 *  assistive technology; the status region announces the sentence instead. */
function TagsLoading() {
  return (
    <div role="status">
      <span className="sr-only">Loading tags</span>
      <Table aria-hidden="true">
        <TagsTableHeader />
        <TableBody>
          {[0, 1, 2].map((row) => (
            <TableRow key={row}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Skeleton className="size-11 rounded-full" />
                  <Skeleton className="h-7 w-20 rounded-full" />
                </div>
              </TableCell>
              <TableCell className="w-full">
                <Skeleton className="h-7 w-40" />
              </TableCell>
              <TableCell className="w-[1%]">
                <Skeleton className="size-11" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
