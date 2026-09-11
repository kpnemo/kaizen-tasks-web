import { ClipboardCheck, FileText, Gauge } from "lucide-react";
import { Link } from "react-router";
import type { Conversation, FeatureRequestDraft, RubricScore } from "@/api/models";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

const FIELDS: { key: keyof FeatureRequestDraft; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "problem", label: "Problem" },
  { key: "proposedBehavior", label: "Proposed behavior" },
  { key: "acceptanceCriteria", label: "Acceptance criteria" },
  { key: "outOfScope", label: "Out of scope" },
];

const SUB_SCORES: { key: keyof RubricScore["reasons"]; label: string }[] = [
  { key: "clarity", label: "Clarity" },
  { key: "complexity", label: "Complexity" },
  { key: "risk", label: "Risk" },
];

const EMPTY = "Not filled in yet";

/** The readiness score. Before the first score it is a plain chip; once scored it is a button
 *  that opens the three sub-scores with the assistant's one-line reason for each, so the most
 *  interesting number in the interview is on screen for the room, not in a hover title. */
function Readiness({ score }: { score: RubricScore | null }) {
  if (!score) {
    return (
      <Badge variant="outline">
        <Gauge aria-hidden="true" />
        Readiness not scored yet
      </Badge>
    );
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <Gauge data-icon="inline-start" aria-hidden="true" />
          Readiness {score.readiness} of 20
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-80 flex-col gap-3 text-base">
        <PopoverHeader className="text-base">
          <PopoverTitle>How the request scores</PopoverTitle>
        </PopoverHeader>
        <dl className="flex flex-col gap-3">
          {SUB_SCORES.map((sub) => (
            <div key={sub.key} className="flex flex-col gap-1">
              <dt>
                <Badge variant="outline">
                  {sub.label} {score[sub.key]}
                </Badge>
              </dt>
              <dd className="text-muted-foreground">{score.reasons[sub.key]}</dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}

/** The right half of the interview (spec 2 and 4.1): the readiness score, the five fields as
 *  read-only text, and the two ways out: review the prefilled form, or skip to the plain one.
 *  A Card that is also the "Your request" region the tests and the smoke test look for. */
export function DraftPanel({
  conversation,
  onReview,
}: {
  conversation: Conversation;
  onReview: () => void;
}) {
  const score = conversation.score;
  // The API sets `ready` both when the request scores as ready and at the eighth question
  // (spec 2, "Ready"); the count is the belt-and-braces path if a turn's status lags.
  const ready = conversation.status === "ready" || conversation.questionCount >= 8;

  return (
    <Card role="region" aria-label="Your request" className="min-w-0 self-start">
      <CardHeader>
        <CardTitle>
          <h2>Your request</h2>
        </CardTitle>
        <CardDescription className="text-base">Filled in as you answer</CardDescription>
        <div className="flex">
          <Readiness score={score} />
        </div>
      </CardHeader>

      <CardContent>
        <dl className="flex min-w-0 flex-col gap-4">
          {FIELDS.map((field) => {
            const value = conversation.draft[field.key]?.trim() ?? "";
            return (
              <div key={field.key} className="flex min-w-0 flex-col gap-1">
                <dt className="font-semibold">{field.label}</dt>
                <dd className="break-words whitespace-pre-line">
                  {value === "" ? <Badge variant="outline">{EMPTY}</Badge> : value}
                </dd>
              </div>
            );
          })}
        </dl>
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-3">
        <p className="text-muted-foreground">
          {ready ? "Ready to file." : "Answer a couple more questions to file."}
        </p>
        <Button disabled={!ready} onClick={onReview}>
          <ClipboardCheck data-icon="inline-start" aria-hidden="true" />
          Review and file
        </Button>
        <Button asChild variant="link" className="h-auto self-start whitespace-normal">
          <Link to="/request-feature?mode=form">
            <FileText data-icon="inline-start" aria-hidden="true" />
            Skip the interview, fill the form
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
