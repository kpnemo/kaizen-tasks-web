import type { Conversation, ConversationEvent } from "./models";

/** The payload of one `ConversationEvent` member, by name. */
type PayloadOf<K extends ConversationEvent["event"]> = Extract<
  ConversationEvent,
  { event: K }
>["data"];

/** The `error` event's payload: the API's own error code and message (spec 3.3). */
export type ConversationStreamError = PayloadOf<"error">;

export type ConversationStreamHandlers = {
  onDelta: (text: string) => void;
  onState: (conversation: Conversation) => void;
  onError: (failure: ConversationStreamError) => void;
  onDone: () => void;
};

/** A frame ends at a blank line; CRLF is tolerated in case a proxy rewrites the line endings. */
const FRAME_END = /\r?\n\r?\n/;

function dispatch(frame: string, handlers: ConversationStreamHandlers): void {
  let name = "";
  const data: string[] = [];
  for (const line of frame.split(/\r?\n/)) {
    if (line === "" || line.startsWith(":")) continue; // blank or comment (`: ping`)
    if (line.startsWith("event:")) name = line.slice("event:".length).trim();
    else if (line.startsWith("data:")) data.push(line.slice("data:".length).replace(/^ /, ""));
  }
  if (name === "" || data.length === 0) return;
  let payload: unknown;
  try {
    payload = JSON.parse(data.join("\n"));
  } catch {
    return; // a frame we cannot read is skipped; `done` still ends the turn
  }
  switch (name) {
    case "delta":
      handlers.onDelta((payload as PayloadOf<"delta">).text);
      return;
    case "state":
      handlers.onState((payload as PayloadOf<"state">).conversation);
      return;
    case "error":
      handlers.onError(payload as PayloadOf<"error">);
      return;
    case "done":
      handlers.onDone();
      return;
    default:
      return;
  }
}

/** Reads one `text/event-stream` body to the end, dispatching each event (spec 3.3). Resolves when
 *  the body closes: the server calls `res.end()` right after the `done` event, and the end of the
 *  body — not the `done` event alone — is what the client treats as completion (spec 3.2).
 *  A malformed frame is skipped, never thrown. */
export async function readConversationStream(
  stream: ReadableStream<Uint8Array>,
  handlers: ConversationStreamHandlers,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      for (let end = FRAME_END.exec(buffer); end; end = FRAME_END.exec(buffer)) {
        dispatch(buffer.slice(0, end.index), handlers);
        buffer = buffer.slice(end.index + end[0].length);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim() !== "") dispatch(buffer, handlers);
  } finally {
    reader.releaseLock();
  }
}
