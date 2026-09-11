import { Pencil } from "lucide-react";
import { useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";

/** The editor inherits the size of the text it replaces at every breakpoint: the `md:` twin beats
 *  the shadcn Input's own `md:text-sm`. */
const INHERIT_SIZE = "text-[length:inherit] md:text-[length:inherit]";

type Props = {
  value: string;
  onSave: (next: string) => void;
  /** Accessible name of the editor control ("Title", "Step title", "Description"). */
  label: string;
  as?: "h1" | "p" | "span";
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  /** Controlled editing state, for "edit then accept". */
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  allowEmpty?: boolean;
};

/** Text that edits in place. The static view is a ghost Button whose text is the value, so a
 *  wrapping heading keeps the value as its accessible name; a pencil after the text says it is
 *  editable without waiting for a hover. Saves on Enter or blur, cancels on Escape.
 *  Both views sit inside the same `Tag` carrying the caller's `className`, and the control inside
 *  inherits its font: that is how the editor keeps the size of the text it replaces at every
 *  breakpoint (a size class on the control itself would lose at `md` to the shadcn Input's own
 *  `md:text-sm`, or to the twin that neutralises it).
 *  The editor is a child component mounted only while editing; it owns the draft, so no state
 *  setter runs inside an effect (react-hooks/set-state-in-effect). */
export function InlineText({
  value,
  onSave,
  label,
  as: Tag = "span",
  multiline = false,
  placeholder = "Add text",
  className,
  editing: editingProp,
  onEditingChange,
  allowEmpty = false,
}: Props) {
  const [editingState, setEditingState] = useState(false);
  const editing = editingProp ?? editingState;

  function setEditing(next: boolean) {
    setEditingState(next);
    onEditingChange?.(next);
  }

  return (
    <Tag className={cn("min-w-0", className)}>
      {editing ? (
        <InlineEditor
          label={label}
          initial={value}
          multiline={multiline}
          onCommit={(next) => {
            if (next !== value && (next || allowEmpty)) onSave(next);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        // `text-[length:inherit]` and `font-[weight:inherit]` are the spellings tailwind-merge
        // reads as font-size and font-weight, so they replace the Button's `text-base font-medium`
        // rather than sitting beside them. `has-[>svg]:px-2` because the Button's own
        // `has-[>svg]:px-3` outranks a plain `px-2` once the pencil is inside.
        <Button
          type="button"
          variant="ghost"
          onClick={() => setEditing(true)}
          className={cn(
            "h-auto w-full justify-start px-2 text-left font-[weight:inherit] text-[length:inherit] whitespace-normal has-[>svg]:px-2",
            !value && "text-muted-foreground",
          )}
        >
          {value || placeholder}
          <Pencil data-icon="inline-end" aria-hidden="true" className="text-muted-foreground" />
        </Button>
      )}
    </Tag>
  );
}

function InlineEditor({
  label,
  initial,
  multiline,
  onCommit,
  onCancel,
}: {
  label: string;
  initial: string;
  multiline: boolean;
  onCommit: (next: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  // Enter commits and the parent then unmounts this editor; the guard keeps a blur that lands in
  // between from committing or cancelling a second time.
  const settled = useRef(false);

  function commit() {
    if (settled.current) return;
    settled.current = true;
    onCommit(multiline ? draft.trimEnd() : draft.trim());
  }

  function cancel() {
    if (settled.current) return;
    settled.current = true;
    onCancel();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    } else if (event.key === "Enter" && (!multiline || event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      commit();
    }
  }

  // INHERIT_SIZE keeps a title from shrinking to the form-control size the moment it becomes
  // editable; `h-auto` lets the Input grow with a heading's line height (the 44px floor still
  // comes from globals.css).
  const shared = {
    "aria-label": label,
    value: draft,
    autoFocus: true,
    onFocus: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      event.currentTarget.select(),
    onBlur: commit,
    onKeyDown,
  };
  return multiline ? (
    <Textarea
      rows={3}
      {...shared}
      className={INHERIT_SIZE}
      onChange={(e) => setDraft(e.target.value)}
    />
  ) : (
    <Input
      {...shared}
      className={cn("h-auto", INHERIT_SIZE)}
      onChange={(e) => setDraft(e.target.value)}
    />
  );
}
