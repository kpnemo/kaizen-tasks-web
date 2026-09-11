import { CircleAlert, RotateCcw, Rocket, Ship, type LucideIcon } from "lucide-react";
import { useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import { toApiError, type ApiError } from "@/api/errors";
import type { DeployStagingResult, PipelineIssue } from "@/api/models";
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
import { useDeployStaging, useRetryShip, useShip } from "../hooks";
import type { PipelineAction } from "./IssueAction";

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
    case "retry":
      return {
        title: `Retry ship ${action.version}`,
        description: `Runs the ship workflow again for ${action.version} with #${action.issue.number}. Steps that already finished are skipped.`,
        verb: `Retry ship ${action.version}`,
        icon: RotateCcw,
      };
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
 *  the length of one request and nowhere else. */
export function DeployDialog({
  action,
  onClose,
}: {
  action: PipelineAction | null;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
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
      >
        {action && (
          <DeployForm key={keyOf(action)} action={action} onClose={onClose} inputRef={inputRef} />
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeployForm({
  action,
  onClose,
  inputRef,
}: {
  action: PipelineAction;
  onClose: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
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

  async function submit() {
    if (!passphrase || pending) return;
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
      <AlertDialogFooter>
        <AlertDialogCancel type="button" disabled={pending}>
          Cancel
        </AlertDialogCancel>
        <AlertDialogAction
          type="button"
          disabled={!passphrase || pending}
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
