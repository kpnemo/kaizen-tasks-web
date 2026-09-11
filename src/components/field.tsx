import { CircleAlert } from "lucide-react";
import { cloneElement, isValidElement, type ReactNode } from "react";
import {
  Field as FieldRoot,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";

/** Label, control, optional hint, and the field error, over the shadcn Field. The hint and the
 *  error render together (a rule the user is breaking is worth more, not less, once it fails), and
 *  the wrapper points the control at both through `aria-describedby`, merged with anything the
 *  caller wrote, so no consumer spells `${id}-hint` or `${id}-error` itself. The control keeps its
 *  own `aria-invalid`. */
export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean);
  return (
    <FieldRoot data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id} className="text-base">
        {label}
      </FieldLabel>
      {withDescribedBy(children, describedBy)}
      {hint ? (
        <FieldDescription id={`${id}-hint`} className="text-base">
          {hint}
        </FieldDescription>
      ) : null}
      {error ? (
        <FieldError
          id={`${id}-error`}
          className="flex items-center gap-2 text-base [&>svg]:size-4 [&>svg]:shrink-0"
        >
          <CircleAlert aria-hidden="true" />
          {error}
        </FieldError>
      ) : null}
    </FieldRoot>
  );
}

/** Adds the hint and error ids to the control's `aria-describedby`, after any it already carries. */
function withDescribedBy(children: ReactNode, ids: string[]): ReactNode {
  if (ids.length === 0 || !isValidElement<{ "aria-describedby"?: string }>(children)) {
    return children;
  }
  const own = children.props["aria-describedby"]?.split(/\s+/).filter(Boolean) ?? [];
  const merged = [...own, ...ids.filter((id) => !own.includes(id))].join(" ");
  return cloneElement(children, { "aria-describedby": merged });
}
