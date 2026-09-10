import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { FeatureRequestResult } from "@/api/models";
import { toastApiError } from "@/components/api-error-toast";
import { Button } from "@/components/ui/button";
import { ConversationPanel } from "./components/ConversationPanel";
import { DraftPanel } from "./components/DraftPanel";
import { FeatureRequestForm } from "./components/FeatureRequestForm";
import { useConversation, useFeatureRequestAvailable, useStartConversation } from "./hooks";

/** The three modes of /request-feature (spec 4.1): the interview by default, the prefilled form
 *  after "Review and file", and the plain form when the URL carries ?mode=form. */
export function RequestFeaturePage() {
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
    if (conversation.isPending || conversation.isError || start.isPending || requested.current) {
      return;
    }
    requested.current = true;
    start.mutate();
  }, [interview, conversation.data, conversation.isPending, conversation.isError, start]);

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
          className="min-h-11 h-auto"
          onClick={() => {
            setFiled(null);
            setReviewing(false);
          }}
        >
          File another
        </Button>
      </div>
    );
  }
  if (interview) {
    if (conversation.isError || start.isError) {
      // The message itself was toasted; this is the way back, not a second copy of the error.
      return (
        <div className="space-y-4">
          <h1>Request a feature</h1>
          <p className="max-w-prose text-muted-foreground">
            The interview could not be started. You can try again, or fill the form yourself.
          </p>
          <Button className="min-h-11 h-auto" onClick={retryStart}>
            Try again
          </Button>
          <Button asChild variant="link" className="min-h-11 h-auto self-start whitespace-normal">
            <Link to="/request-feature?mode=form">Skip the interview, fill the form</Link>
          </Button>
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
      <div className="space-y-6">
        <h1>Request a feature</h1>
        <p className="max-w-prose text-muted-foreground">
          Answer a few questions and the assistant fills the request beside you. Nothing is filed
          until you review it.
        </p>
        <div className="grid grid-cols-1 gap-6 min-[900px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <ConversationPanel conversation={conversation.data} />
          <DraftPanel conversation={conversation.data} onReview={() => setReviewing(true)} />
        </div>
      </div>
    );
  }

  const refined = reviewing ? conversation.data : null;
  const score = refined?.score ?? null;
  return (
    <FeatureRequestForm
      initialValues={refined?.draft}
      conversationId={refined?.id}
      note={score ? `Refined with the assistant · readiness ${score.readiness} of 20` : undefined}
      onFiled={setFiled}
    />
  );
}
