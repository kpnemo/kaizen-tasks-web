import { useState, type ChangeEvent } from "react";
import { toApiError } from "@/api/errors";
import type { FeatureRequestBody, FeatureRequestDraft, FeatureRequestResult } from "@/api/models";
import { toastApiError } from "@/components/api-error-toast";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitFeatureRequest } from "../hooks";

const EMPTY: FeatureRequestBody = {
  title: "",
  problem: "",
  proposedBehavior: "",
  acceptanceCriteria: "",
  outOfScope: "",
};

const FIELDS: {
  key: keyof FeatureRequestDraft;
  label: string;
  hint: string;
  multiline: boolean;
}[] = [
  {
    key: "title",
    label: "Title",
    hint: "One line, the way you would name it in a release note",
    multiline: false,
  },
  { key: "problem", label: "Problem", hint: "What is hard today, and for whom", multiline: true },
  {
    key: "proposedBehavior",
    label: "Proposed behavior",
    hint: "What the product should do instead",
    multiline: true,
  },
  {
    key: "acceptanceCriteria",
    label: "Acceptance criteria",
    hint: "How we will know it works",
    multiline: true,
  },
  {
    key: "outOfScope",
    label: "Out of scope",
    hint: "What this request deliberately leaves out (optional)",
    multiline: true,
  },
];

/** The five-field issue form. With `initialValues` it opens prefilled from the interview draft and
 *  posts `conversationId` alongside the fields, so the issue carries the self-score and the
 *  transcript (spec 2, "Review and file"). Every value stays editable. */
export function FeatureRequestForm({
  initialValues,
  conversationId,
  note,
  onFiled,
}: {
  initialValues?: FeatureRequestDraft;
  conversationId?: string;
  note?: string;
  onFiled: (result: FeatureRequestResult) => void;
}) {
  const submit = useSubmitFeatureRequest();
  const [values, setValues] = useState<FeatureRequestBody>(() => ({ ...EMPTY, ...initialValues }));
  const error = submit.error ? toApiError(submit.error) : null;
  const fields = error?.fieldErrors() ?? {};

  return (
    <div className="space-y-8">
      <h1>Request a feature</h1>
      <p className="max-w-prose text-muted-foreground">
        The same five fields as the GitHub issue form. Clear requests with acceptance criteria get
        implemented first.
      </p>
      {note ? <p className="font-semibold text-muted-foreground">{note}</p> : null}
      <form
        aria-label="Request a feature"
        className="max-w-2xl space-y-6"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const body: FeatureRequestBody = {
            ...values,
            outOfScope: values.outOfScope?.trim() ? values.outOfScope : undefined,
            ...(conversationId ? { conversationId } : {}),
          };
          submit.mutate(body, {
            onSuccess: onFiled,
            onError: (e) => {
              if (toApiError(e).code !== "VALIDATION_ERROR") toastApiError(e);
            },
          });
        }}
      >
        {FIELDS.map((field) => {
          const id = `fr-${field.key}`;
          const shared = {
            id,
            value: values[field.key] ?? "",
            "aria-invalid": Boolean(fields[field.key]),
            "aria-describedby": fields[field.key] ? `${id}-error` : `${id}-hint`,
            onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
              setValues((v) => ({ ...v, [field.key]: e.target.value })),
          };
          return (
            <Field
              key={field.key}
              id={id}
              label={field.label}
              hint={field.hint}
              error={fields[field.key]}
            >
              {field.multiline ? (
                <Textarea rows={3} {...shared} />
              ) : (
                <Input maxLength={200} {...shared} />
              )}
            </Field>
          );
        })}
        {error && error.code !== "VALIDATION_ERROR" ? (
          <p className="text-muted-foreground">
            Nothing was filed. Fix the problem above and send again.
          </p>
        ) : null}
        <Button type="submit" className="min-h-11 h-auto" disabled={submit.isPending}>
          Send request
        </Button>
      </form>
    </div>
  );
}
