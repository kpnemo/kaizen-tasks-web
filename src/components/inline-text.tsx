import { useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

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

/** Text that edits in place. The static view is a button whose text is the value, so a wrapping
 *  heading keeps the value as its accessible name. Saves on Enter or blur, cancels on Escape.
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

  if (editing) {
    return (
      <InlineEditor
        label={label}
        initial={value}
        multiline={multiline}
        className={className}
        onCommit={(next) => {
          if (next !== value && (next || allowEmpty)) onSave(next);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <Tag className={cn("min-w-0", className)}>
      <button
        type="button"
        title="Click to edit"
        onClick={() => setEditing(true)}
        className={cn(
          "w-full rounded-md text-left hover:bg-accent/60 focus-visible:bg-accent/60",
          !value && "text-muted-foreground",
        )}
      >
        {value || placeholder}
      </button>
    </Tag>
  );
}

function InlineEditor({
  label,
  initial,
  multiline,
  className,
  onCommit,
  onCancel,
}: {
  label: string;
  initial: string;
  multiline: boolean;
  className?: string;
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

  const shared = {
    "aria-label": label,
    value: draft,
    autoFocus: true,
    onFocus: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      event.currentTarget.select(),
    onBlur: commit,
    onKeyDown,
    className: cn(
      "w-full rounded-md border border-input bg-card px-3 py-2 font-[inherit] text-[inherit]",
      className,
    ),
  };
  return multiline ? (
    <textarea rows={3} {...shared} onChange={(e) => setDraft(e.target.value)} />
  ) : (
    <input {...shared} onChange={(e) => setDraft(e.target.value)} />
  );
}
