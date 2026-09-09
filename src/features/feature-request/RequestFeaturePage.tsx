import { useState, type ChangeEvent } from "react";
import { toApiError } from "@/api/errors";
import type { FeatureRequestBody, FeatureRequestResult } from "@/api/models";
import { toastApiError } from "@/components/api-error-toast";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFeatureRequestAvailable, useSubmitFeatureRequest } from "./hooks";

const EMPTY: FeatureRequestBody = {
  title: "",
  problem: "",
  proposedBehavior: "",
  acceptanceCriteria: "",
  outOfScope: "",
};

const FIELDS: { key: keyof FeatureRequestBody; label: string; hint: string; multiline: boolean }[] =
  [
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

export function RequestFeaturePage() {
  const { available } = useFeatureRequestAvailable();
  const submit = useSubmitFeatureRequest();
  const [values, setValues] = useState<FeatureRequestBody>(EMPTY);
  const [filed, setFiled] = useState<FeatureRequestResult | null>(null);
  const error = submit.error ? toApiError(submit.error) : null;
  const fields = error?.fieldErrors() ?? {};

  if (available === undefined) {
    return (
      <p role="status" className="text-muted-foreground">
        Checking availability
      </p>
    );
  }
  if (!available) {
    return (
      <div className="space-y-4">
        <h1>Request a feature</h1>
        <p className="text-muted-foreground">
          Feature requests are not available in this environment.
        </p>
      </div>
    );
  }
  if (filed) {
    return (
      <div className="space-y-4">
        <h1>Request #{filed.issueNumber} filed</h1>
        <p>
          Thank you. It is now in the queue the engineering harness triages.{" "}
          <a
            href={filed.issueUrl}
            className="font-semibold text-primary underline"
            target="_blank"
            rel="noreferrer"
          >
            Open the issue
          </a>
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setFiled(null);
            setValues(EMPTY);
            submit.reset();
          }}
        >
          File another
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1>Request a feature</h1>
      <p className="max-w-prose text-muted-foreground">
        The same five fields as the GitHub issue form. Clear requests with acceptance criteria get
        implemented first.
      </p>
      <form
        aria-label="Request a feature"
        className="max-w-2xl space-y-6"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const body: FeatureRequestBody = {
            ...values,
            outOfScope: values.outOfScope?.trim() ? values.outOfScope : undefined,
          };
          submit.mutate(body, {
            onSuccess: setFiled,
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
        <Button type="submit" disabled={submit.isPending}>
          Send request
        </Button>
      </form>
    </div>
  );
}
