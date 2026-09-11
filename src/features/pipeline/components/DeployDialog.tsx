import { CircleAlert, RotateCcw, Rocket, Ship, TriangleAlert, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import { toApiError, type ApiError } from "@/api/errors";
import type { DeployStagingResult, PipelineIssue, PipelineSnapshot } from "@/api/models";
import { Field } from "@/components/field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { formatClock } from "@/lib/format";
import { blockerFor, type PipelineAction } from "../actions";
import { useDeployStaging, useRetryShip, useShip } from "../hooks";

const LIST = new Intl.ListFormat("en", { type: "conjunction" });
const numbers = (issues: PipelineIssue[]) => LIST.format(issues.map((i) => `#${i.number}`));

type Copy = { title: string; description: string; verb: string; icon: LucideIcon };

/** The words for each of the three actions: the title names the thing, the description says
 *  exactly what will happen, the verb is the button (spec "The page", block 4). */
function copyFor(action: PipelineAction): Copy {
  switch (action.kind) {
    case "staging": {
      const open = action.issue.pullRequests
        .filter((pr) => pr.state === "open")
        .map((pr) => `${pr.repo} #${pr.number}`);
      return {
        title: `Deploy #${action.issue.number} to staging`,
        description: `Merges ${LIST.format(open)} into develop, in that order. Railway then deploys staging, and the row moves on the next refresh.`,
        verb: "Deploy to staging",
        icon: Rocket,
      };
    }
    case "production":
      return {
        title: `Deploy ${action.version} to production`,
        description: `Ships ${numbers(action.issues)} to production as ${action.version}: the ship workflow cuts the release in both repositories, promotes develop to main, and closes the issues once production serves it.`,
        verb: `Deploy ${action.version} to production`,
        icon: Ship,
      };
    case "retry": {
      // The API re-dispatches the marker's whole issue set, not the pressed row alone.
      const covers = LIST.format(action.covers.map((number) => `#${number}`));
      return {
        title: `Retry ship ${action.version}`,
        description: `Retries the failed ship of ${action.version}, which covers ${covers}. Steps that already finished are skipped.`,
        verb: `Retry ship ${action.version}`,
        icon: RotateCcw,
      };
    }
  }
}

/** Where a failed press is shown: on the field for the two answers about the passphrase itself,
 *  inline for a conflict or anything else the API said in a sentence, nowhere for a request that
 *  never reached the API (the hook toasted it). */
function describeFailure(error: ApiError): { field?: string; message?: string } {
  if (error.forbiddenReason() === "passphrase") return { field: "Wrong passphrase" };
  const limit = error.rateLimit();
  if (limit) return { field: `Too many attempts, try again at ${formatClock(limit.resetAt)}` };
  if (error.status === 0) return {};
  return { message: error.message };
}

/** The room sees the click land at once; the row itself moves on the next ten-second poll. */
function announceStaging(issue: PipelineIssue, result: DeployStagingResult) {
  const merged = result.merged.map((m) => `${m.repo} #${m.number}`);
  if (merged.length > 0) {
    toast.success(`Deploying #${issue.number} to staging: merged ${LIST.format(merged)}`);
  }
  if (result.remaining.length > 0) {
    const left = result.remaining.map((r) => `${r.repo} #${r.number} (${r.reason})`);
    toast.warning(`Not merged: ${LIST.format(left)}`, {
      description: "Press Deploy to staging again to finish.",
    });
  }
}

const keyOf = (action: PipelineAction) =>
  action.kind === "production"
    ? `production-${action.version}-${action.issues.map((i) => i.number).join(",")}`
    : `${action.kind}-${action.issue.number}`;

/** The passphrase dialog behind both facilitator buttons and the retry (spec, block 4): an
 *  AlertDialog whose title and description say what will happen, one password Field, Cancel and
 *  the verb. A wrong passphrase and a lockout are the field's error; a conflict is the API's
 *  sentence inline; success closes the dialog and the snapshot is refetched by the hook. The form
 *  is keyed by the action so every opening starts clean, and the passphrase lives in its state for
 *  the length of one request and nowhere else.
 *
 *  `snapshot` is the live one, so the form re-checks the row's eligibility on every poll rather
 *  than trusting the press that opened it; and the dialog cannot be dismissed while a request is in
 *  flight, or the API's answer would land in a closed dialog and be lost. */
export function DeployDialog({
  action,
  snapshot,
  onClose,
}: {
  action: PipelineAction | null;
  snapshot: PipelineSnapshot;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Whether the form has a request in flight, read by the Escape handler at the moment of the key.
  const pendingRef = useRef(false);
  return (
    <AlertDialog
      open={action !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent
        onOpenAutoFocus={(event) => {
          // The passphrase is the only thing to do here, so it takes focus rather than Cancel.
          event.preventDefault();
          inputRef.current?.focus();
        }}
        onEscapeKeyDown={(event) => {
          // Escape while the API is answering would drop a CONFLICT or a wrong-passphrase answer
          // on the floor; the dialog closes once the answer is on screen or the press succeeded.
          // Radix's AlertDialog has no outside-pointer dismissal, so there is nothing else to hold.
          if (pendingRef.current) event.preventDefault();
        }}
      >
        {action && (
          <DeployForm
            key={keyOf(action)}
            action={action}
            snapshot={snapshot}
            onClose={onClose}
            inputRef={inputRef}
            pendingRef={pendingRef}
          />
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeployForm({
  action,
  snapshot,
  onClose,
  inputRef,
  pendingRef,
}: {
  action: PipelineAction;
  snapshot: PipelineSnapshot;
  onClose: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  pendingRef: RefObject<boolean>;
}) {
  const copy = copyFor(action);
  const Icon = copy.icon;
  const [passphrase, setPassphrase] = useState("");
  const deployStaging = useDeployStaging();
  const shipRelease = useShip();
  const retryShip = useRetryShip();
  const pending = deployStaging.isPending || shipRelease.isPending || retryShip.isPending;
  const raw = deployStaging.error ?? shipRelease.error ?? retryShip.error;
  const failure = raw ? describeFailure(toApiError(raw)) : null;
  // Recomputed from the live snapshot on every render, so a poll that lands while the dialog is
  // open takes the verb away at once; `submit` reads the same value, so a stale click never sends.
  const blocked = blockerFor(action, snapshot);

  useEffect(() => {
    pendingRef.current = pending;
    return () => {
      pendingRef.current = false;
    };
  }, [pending, pendingRef]);

  async function submit() {
    if (!passphrase || pending || blocked) return;
    try {
      if (action.kind === "staging") {
        const result = await deployStaging.mutateAsync({
          number: action.issue.number,
          passphrase,
        });
        announceStaging(action.issue, result);
      } else if (action.kind === "production") {
        const result = await shipRelease.mutateAsync({
          passphrase,
          version: action.version,
          issues: action.issues.map((issue) => issue.number),
        });
        toast.success(`Ship ${result.version} started for ${numbers(action.issues)}`, {
          description: result.run
            ? "Follow it from the Shipping badge on the row."
            : "GitHub has not shown the run yet; the row picks it up on the next refresh.",
        });
      } else {
        const result = await retryShip.mutateAsync({ passphrase, issue: action.issue.number });
        toast.success(`Ship ${result.version} retried for #${action.issue.number}`);
      }
      onClose();
    } catch {
      // Shown inline through `failure`; a request that never reached the API was toasted by the hook.
    }
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <AlertDialogHeader>
        <AlertDialogTitle>{copy.title}</AlertDialogTitle>
        <AlertDialogDescription className="text-base">{copy.description}</AlertDialogDescription>
      </AlertDialogHeader>
      <Field id="deploy-passphrase" label="Deploy passphrase" error={failure?.field}>
        <Input
          ref={inputRef}
          id="deploy-passphrase"
          type="password"
          autoComplete="off"
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
          aria-invalid={failure?.field ? true : undefined}
          disabled={pending}
        />
      </Field>
      {failure?.message && (
        <Alert variant="destructive" className="text-base">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Not deployed</AlertTitle>
          <AlertDescription className="text-base">{failure.message}</AlertDescription>
        </Alert>
      )}
      {blocked && (
        <Alert>
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>Cannot continue</AlertTitle>
          <AlertDescription>{blocked} Cancel and read the row again.</AlertDescription>
        </Alert>
      )}
      <AlertDialogFooter>
        <AlertDialogCancel type="button" disabled={pending}>
          Cancel
        </AlertDialogCancel>
        <AlertDialogAction
          type="button"
          disabled={!passphrase || pending || blocked !== null}
          onClick={(event) => {
            // Radix closes on Action by default; the dialog closes only once the API has answered.
            event.preventDefault();
            void submit();
          }}
        >
          {pending ? (
            <Spinner aria-hidden="true" data-icon="inline-start" />
          ) : (
            <Icon aria-hidden="true" data-icon="inline-start" />
          )}
          {copy.verb}
        </AlertDialogAction>
      </AlertDialogFooter>
    </form>
  );
}
