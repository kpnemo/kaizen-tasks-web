import {
  ArrowLeft,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  FileText,
  Info,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { FeatureRequestResult } from "@/api/models";
import { toastApiError } from "@/components/api-error-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ConversationPanel } from "./components/ConversationPanel";
import { DraftPanel } from "./components/DraftPanel";
import { FeatureRequestForm } from "./components/FeatureRequestForm";
import { RequestsSoFar } from "./components/RequestsSoFar";
import { useConversation, useFeatureRequestAvailable, useStartConversation } from "./hooks";

/** The page: one of the three modes above the "Requests so far" list (issue #22), which is
 *  rendered only once health has confirmed the feature, so it never fires on an API without it. */
export function RequestFeaturePage() {
  const { available } = useFeatureRequestAvailable();
  return (
    <div className="flex flex-col gap-8">
      <RequestFeatureBody />
      {available === true && <RequestsSoFar />}
    </div>
  );
}

/** The three modes of /request-feature (spec 4.1): the interview by default, the prefilled form
 *  after "Review and file", and the plain form when the URL carries ?mode=form. */
function RequestFeatureBody() {
  const { available } = useFeatureRequestAvailable();
  const [searchParams] = useSearchParams();
  const [reviewing, setReviewing] = useState(false);
  const [filed, setFiled] = useState<FeatureRequestResult | null>(null);
  const conversation = useConversation(available === true);
  const start = useStartConversation();

  const formOnly = searchParams.get("mode") === "form";
  const interview = available === true && !formOnly && !reviewing && filed === null;

  // useQuery has no onError in TanStack Query v5, so the read failure is toasted here. The start
  // failure toasts through useStartConversation's own onError.
  useEffect(() => {
    if (conversation.isError) toastApiError(conversation.error);
  }, [conversation.isError, conversation.error]);

  // Spec 2, "Start": resume the caller's open conversation, otherwise ask the API to create one
  // (its first assistant message is the fixed greeting). The ref re-arms whenever a conversation
  // exists, so "File another" opens a fresh interview.
  const requested = useRef(false);
  useEffect(() => {
    if (!interview) return;
    if (conversation.data) {
      requested.current = false;
      return;
    }
    if (
      conversation.isPending ||
      conversation.isFetching ||
      conversation.isError ||
      start.isPending ||
      requested.current
    ) {
      return;
    }
    requested.current = true;
    start.mutate();
  }, [
    interview,
    conversation.data,
    conversation.isPending,
    conversation.isFetching,
    conversation.isError,
    start,
  ]);

  /** Clears the one-shot guard and re-reads; a `null` read then re-arms the auto-start. */
  function retryStart() {
    requested.current = false;
    start.reset();
    void conversation.refetch();
  }

  if (available === undefined) {
    return (
      <p role="status" className="text-muted-foreground">
        Checking availability
      </p>
    );
  }
  if (!available) {
    return (
      <div className="flex flex-col gap-4">
        <h1>Request a feature</h1>
        <Alert role="status" className="max-w-2xl text-base">
          <Info aria-hidden="true" />
          <AlertTitle>Feature requests are off in this environment</AlertTitle>
          <AlertDescription className="text-base">
            Feature requests are not available in this environment.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  if (filed) {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>
            <h1 className="flex items-center gap-3">
              <CircleCheck aria-hidden="true" className="size-8 shrink-0 text-primary" />
              Request #{filed.issueNumber} filed
            </h1>
          </CardTitle>
          <CardDescription className="text-base">
            Thank you. It is now in the queue the engineering harness triages.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex-wrap gap-3">
          <Button asChild>
            <a href={filed.issueUrl} target="_blank" rel="noreferrer">
              Open the issue
              <ExternalLink data-icon="inline-end" aria-hidden="true" />
            </a>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setFiled(null);
              setReviewing(false);
            }}
          >
            <Plus data-icon="inline-start" aria-hidden="true" />
            File another
          </Button>
        </CardFooter>
      </Card>
    );
  }
  if (interview) {
    if (conversation.isError || start.isError) {
      // The message itself was toasted; this is the way back, not a second copy of the error.
      return (
        <div className="flex flex-col gap-4">
          <h1>Request a feature</h1>
          <Alert variant="destructive" className="max-w-2xl text-base">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>The interview could not be started</AlertTitle>
            <AlertDescription className="text-base">
              You can try again, or fill the form yourself.
            </AlertDescription>
          </Alert>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={retryStart}>
              <RefreshCw data-icon="inline-start" aria-hidden="true" />
              Try again
            </Button>
            <Button asChild variant="outline">
              <Link to="/request-feature?mode=form">
                <FileText data-icon="inline-start" aria-hidden="true" />
                Skip the interview, fill the form
              </Link>
            </Button>
          </div>
        </div>
      );
    }
    if (!conversation.data) {
      return (
        <p role="status" className="text-muted-foreground">
          Starting the interview
        </p>
      );
    }
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <h1>Request a feature</h1>
          <p className="max-w-prose text-muted-foreground">
            Answer a few questions and the assistant fills the request beside you. Nothing is filed
            until you review it.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 min-[900px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <ConversationPanel conversation={conversation.data} />
          <DraftPanel conversation={conversation.data} onReview={() => setReviewing(true)} />
        </div>
      </div>
    );
  }

  const refined = reviewing ? conversation.data : null;
  return (
    <div className="flex flex-col gap-4">
      {reviewing && (
        // A 409 on filing (the conversation was already filed or abandoned) leaves a body that can
        // never succeed; this is the way back that does not lose the conversation (review finding 3).
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => setReviewing(false)}
        >
          <ArrowLeft data-icon="inline-start" aria-hidden="true" />
          Back to the interview
        </Button>
      )}
      <FeatureRequestForm
        initialValues={refined?.draft}
        conversationId={refined?.id}
        score={refined?.score ?? null}
        onFiled={setFiled}
      />
    </div>
  );
}
