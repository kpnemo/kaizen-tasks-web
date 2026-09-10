import { Link } from "react-router";
import type { Conversation, FeatureRequestDraft } from "@/api/models";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const FIELDS: { key: keyof FeatureRequestDraft; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "problem", label: "Problem" },
  { key: "proposedBehavior", label: "Proposed behavior" },
  { key: "acceptanceCriteria", label: "Acceptance criteria" },
  { key: "outOfScope", label: "Out of scope" },
];

const EMPTY = "Not filled in yet";

/** 44px floor, and wraps rather than overflowing on a narrow screen: the shared Button ships
 *  `h-9 whitespace-nowrap shrink-0` and tailwind-merge keeps the later utility of each group. */
const WRAPS = "min-h-11 h-auto max-w-full shrink whitespace-normal text-left";

/** The right half of the interview (spec 2 and 4.1): the readiness chip, the five fields as
 *  read-only text, and the two ways out — review the prefilled form, or skip to the plain one. */
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
    <section
      aria-label="Your request"
      className="flex min-w-0 flex-col gap-4 self-start rounded-xl border bg-card p-4"
    >
      <Badge
        variant="outline"
        className="min-h-11 max-w-full self-start px-4 py-2 text-base whitespace-normal"
        title={
          score
            ? `Clarity ${score.clarity} · Complexity ${score.complexity} · Risk ${score.risk}`
            : undefined
        }
      >
        {score ? `Readiness ${score.readiness} of 20` : "Readiness not scored yet"}
      </Badge>

      <dl className="flex min-w-0 flex-col gap-4">
        {FIELDS.map((field) => {
          const value = conversation.draft[field.key]?.trim() ?? "";
          return (
            <div key={field.key} className="flex min-w-0 flex-col gap-1">
              <dt className="text-sm font-semibold text-muted-foreground">{field.label}</dt>
              <dd
                className={cn(
                  "break-words whitespace-pre-line",
                  value === "" && "text-muted-foreground italic",
                )}
              >
                {value === "" ? EMPTY : value}
              </dd>
            </div>
          );
        })}
      </dl>

      <Button className={WRAPS} disabled={!ready} onClick={onReview}>
        Review and file
      </Button>
      <Button asChild variant="link" className={cn(WRAPS, "self-start")}>
        <Link to="/request-feature?mode=form">Skip the interview, fill the form</Link>
      </Button>
    </section>
  );
}
