import { CircleAlert, Gauge, Send, Sparkles } from "lucide-react";
import { useState, type ChangeEvent } from "react";
import { toApiError } from "@/api/errors";
import type {
  FeatureRequestBody,
  FeatureRequestDraft,
  FeatureRequestResult,
  RubricScore,
} from "@/api/models";
import { toastApiError } from "@/components/api-error-toast";
import { Field } from "@/components/field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
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
 *  transcript (spec 2, "Review and file"). Every value stays editable. `score` is the interview's
 *  rubric score, shown as two chips above the form when the draft came from the assistant. */
export function FeatureRequestForm({
  initialValues,
  conversationId,
  score,
  onFiled,
}: {
  initialValues?: FeatureRequestDraft;
  conversationId?: string;
  score?: RubricScore | null;
  onFiled: (result: FeatureRequestResult) => void;
}) {
  const submit = useSubmitFeatureRequest();
  const [values, setValues] = useState<FeatureRequestBody>(() => ({ ...EMPTY, ...initialValues }));
  const error = submit.error ? toApiError(submit.error) : null;
  const fields = error?.fieldErrors() ?? {};

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h1>Request a feature</h1>
        <p className="max-w-prose text-muted-foreground">
          The same five fields as the GitHub issue form. Clear requests with acceptance criteria get
          implemented first.
        </p>
        {score ? (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              <Sparkles aria-hidden="true" />
              Refined with the assistant
            </Badge>
            <Badge variant="outline">
              <Gauge aria-hidden="true" />
              Readiness {score.readiness} of 20
            </Badge>
          </div>
        ) : null}
      </div>
      <form
        aria-label="Request a feature"
        className="flex max-w-2xl flex-col gap-6"
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
        <FieldGroup>
          {FIELDS.map((field) => {
            const id = `fr-${field.key}`;
            const shared = {
              id,
              value: values[field.key] ?? "",
              "aria-invalid": Boolean(fields[field.key]),
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
        </FieldGroup>
        {error && error.code !== "VALIDATION_ERROR" ? (
          // The toast fades; this stays until the next attempt, with the API's own words.
          <Alert variant="destructive" className="text-base">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Nothing was filed</AlertTitle>
            <AlertDescription className="text-base">{error.message}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" className="self-start" disabled={submit.isPending}>
          {submit.isPending ? (
            <Spinner data-icon="inline-start" aria-hidden="true" />
          ) : (
            <Send data-icon="inline-start" aria-hidden="true" />
          )}
          Send request
        </Button>
      </form>
    </div>
  );
}
