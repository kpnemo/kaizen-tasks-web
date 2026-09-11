import { RotateCcw, SendHorizontal, SkipForward, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Conversation } from "@/api/models";
import { Field } from "@/components/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { useSendTurn, useStartConversation } from "../hooks";

/** A chip wraps rather than overflowing: the shared Button is `whitespace-nowrap` and `h-9`, and
 *  tailwind-merge keeps the later utility of each group. The 44px floor comes from globals.css. */
const CHIP_WRAPS = "h-auto max-w-full rounded-full whitespace-normal";

/** One turn of the transcript. The speaker is the side and the fill, and a spoken prefix for the
 *  screen reader; `live` marks the reply that is still streaming in. */
function Bubble({
  who,
  text,
  live = false,
}: {
  who: "assistant" | "user";
  text: string;
  live?: boolean;
}) {
  return (
    <li
      aria-live={live ? "polite" : undefined}
      className={cn(
        "max-w-[46ch] min-w-0 rounded-xl px-4 py-3 break-words whitespace-pre-line",
        who === "assistant" ? "bg-accent text-accent-foreground" : "ml-auto border bg-background",
      )}
    >
      <span className="sr-only">{who === "assistant" ? "Assistant: " : "You: "}</span>
      {text}
    </li>
  );
}

/** The chat half of the interview (spec 2 and 4.1): the transcript, the streaming reply, the
 *  option chips, the skip chip, and the answer box. Every chip and button is a real button whose
 *  visible text is its accessible name (spec 4.4). The transcript scrolls inside the card and
 *  follows the newest turn, so the chips and the answer box never leave the fold. */
export function ConversationPanel({ conversation }: { conversation: Conversation }) {
  const turn = useSendTurn();
  const start = useStartConversation();
  const [answer, setAnswer] = useState("");
  const listRef = useRef<HTMLOListElement>(null);

  const last = conversation.messages.at(-1);
  const options = last?.role === "assistant" ? (last.options ?? []) : [];
  const closed = conversation.status !== "open";
  const busy = turn.isStreaming || start.isPending;

  // Keep the newest turn in view as the transcript grows or a reply streams in. Scrolling the
  // viewport itself, not scrollIntoView, so the page around the card never moves.
  useEffect(() => {
    const viewport = listRef.current?.closest("[data-slot=scroll-area-viewport]");
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [conversation.messages.length, turn.pendingMessage, turn.streamingText, turn.isStreaming]);

  function send(content: string, skip = false) {
    const text = content.trim();
    if (text === "" || busy || closed) return;
    setAnswer("");
    turn.send(
      { id: conversation.id, content: text, skip: skip ? true : undefined },
      // Nothing was persisted, so put the PM's own words back in the box: Send resends them.
      { onError: () => setAnswer(skip ? "" : text) },
    );
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>
          <h2>Kaizen assistant</h2>
        </CardTitle>
        <CardAction>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              turn.reset();
              setAnswer("");
              start.mutate();
            }}
          >
            <RotateCcw data-icon="inline-start" aria-hidden="true" />
            Start over
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="min-w-0">
        {/* A fixed height, not a cap: the chips and the answer box below stay put from the first
            turn, and the transcript scrolls once it outgrows the box. 40vh is 256px at the
            projector's 640px, which keeps the answer box on screen under the sticky header. */}
        <ScrollArea className="h-[40vh]">
          <ol ref={listRef} aria-label="Conversation" className="flex min-w-0 flex-col gap-3 pr-3">
            {conversation.messages.map((message) => (
              <Bubble key={message.id} who={message.role} text={message.content} />
            ))}
            {turn.pendingMessage ? <Bubble who="user" text={turn.pendingMessage} /> : null}
            {turn.isStreaming && turn.streamingText !== "" ? (
              <Bubble who="assistant" text={turn.streamingText} live />
            ) : null}
            {turn.isStreaming && turn.streamingText === "" ? (
              <li className="flex">
                <Badge variant="secondary" role="status" className="animate-thinking">
                  <Sparkles aria-hidden="true" />
                  Thinking
                </Badge>
              </li>
            ) : null}
          </ol>
        </ScrollArea>
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-4">
        {!closed && !busy && options.length > 0 ? (
          <div className="flex min-w-0 flex-wrap gap-2">
            {options.map((option) => (
              <Button
                key={option}
                variant="outline"
                className={CHIP_WRAPS}
                onClick={() => send(option)}
              >
                {option}
              </Button>
            ))}
            <Button
              variant="outline"
              className={CHIP_WRAPS}
              onClick={() => send("(skipped)", true)}
            >
              <SkipForward data-icon="inline-start" aria-hidden="true" />
              Skip this question
            </Button>
          </div>
        ) : null}

        <form
          className="flex min-w-0 flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            send(answer);
          }}
        >
          <Field
            id="interview-answer"
            label="Your answer"
            hint="Enter sends, Shift+Enter starts a new line."
          >
            <Textarea
              id="interview-answer"
              rows={3}
              maxLength={2000}
              value={answer}
              disabled={busy || closed}
              onChange={(event) => setAnswer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send(answer);
                }
              }}
            />
          </Field>
          <Button
            type="submit"
            className="self-start"
            disabled={busy || closed || answer.trim() === ""}
          >
            <SendHorizontal data-icon="inline-start" aria-hidden="true" />
            Send
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
