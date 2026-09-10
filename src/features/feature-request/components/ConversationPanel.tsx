import { useState } from "react";
import type { Conversation } from "@/api/models";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { useSendTurn, useStartConversation } from "../hooks";

/** A chip is at least 44px tall (the projector floor; `min-h-11` is 49.5px at the app's 18px root)
 *  and wraps rather than overflowing: the shared Button is `h-9 whitespace-nowrap shrink-0`, and
 *  tailwind-merge keeps the later utility of each of those three groups. */
const CHIP = "min-h-11 h-auto max-w-full shrink whitespace-normal rounded-full px-4 py-2 text-left";

function Bubble({ who, text }: { who: "assistant" | "user"; text: string }) {
  return (
    <li
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
 *  visible text is its accessible name (spec 4.4). */
export function ConversationPanel({ conversation }: { conversation: Conversation }) {
  const turn = useSendTurn();
  const start = useStartConversation();
  const [answer, setAnswer] = useState("");

  const last = conversation.messages.at(-1);
  const options = last?.role === "assistant" ? (last.options ?? []) : [];
  const closed = conversation.status !== "open";
  const busy = turn.isStreaming || start.isPending;

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
    <div className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-2xl font-bold">Kaizen assistant</h2>
        <Button
          variant="outline"
          className={cn(CHIP, "ml-auto")}
          disabled={busy}
          onClick={() => {
            turn.reset();
            setAnswer("");
            start.mutate();
          }}
        >
          Start over
        </Button>
      </div>

      <ol aria-label="Conversation" className="flex min-w-0 flex-col gap-3">
        {conversation.messages.map((message) => (
          <Bubble key={message.id} who={message.role} text={message.content} />
        ))}
        {turn.pendingMessage ? <Bubble who="user" text={turn.pendingMessage} /> : null}
        {turn.isStreaming && turn.streamingText !== "" ? (
          <li
            aria-live="polite"
            className="max-w-[46ch] min-w-0 rounded-xl bg-accent px-4 py-3 break-words whitespace-pre-line text-accent-foreground"
          >
            <span className="sr-only">Assistant: </span>
            {turn.streamingText}
          </li>
        ) : null}
      </ol>

      {turn.isStreaming && turn.streamingText === "" ? (
        <p role="status" className="animate-thinking text-muted-foreground">
          Thinking
        </p>
      ) : null}

      {!closed && !busy ? (
        <div className="flex min-w-0 flex-wrap gap-2">
          {options.map((option) => (
            <Button key={option} variant="outline" className={CHIP} onClick={() => send(option)}>
              {option}
            </Button>
          ))}
          <Button variant="ghost" className={CHIP} onClick={() => send("(skipped)", true)}>
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
        <Textarea
          aria-label="Your answer"
          placeholder="Type your answer. Enter sends, Shift+Enter starts a new line."
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
        <Button
          type="submit"
          className="min-h-11 h-auto self-start"
          disabled={busy || closed || answer.trim() === ""}
        >
          Send
        </Button>
      </form>
    </div>
  );
}
