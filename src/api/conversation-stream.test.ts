import { describe, expect, it, vi } from "vitest";
import { readConversationStream, type ConversationStreamHandlers } from "./conversation-stream";

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function spies() {
  return {
    onDelta: vi.fn(),
    onState: vi.fn(),
    onError: vi.fn(),
    onDone: vi.fn(),
  } satisfies ConversationStreamHandlers;
}

const CONVERSATION = { id: "c-1", status: "open", questionCount: 1 };

describe("readConversationStream", () => {
  it("dispatches deltas in order, then the state, then done", async () => {
    const handlers = spies();
    await readConversationStream(
      streamOf(
        'event: delta\ndata: {"text":"Got it. "}\n\n',
        'event: delta\ndata: {"text":"Who has the problem?"}\n\n',
        `event: state\ndata: ${JSON.stringify({ conversation: CONVERSATION })}\n\n`,
        "event: done\ndata: {}\n\n",
      ),
      handlers,
    );
    expect(handlers.onDelta.mock.calls).toEqual([["Got it. "], ["Who has the problem?"]]);
    expect(handlers.onState).toHaveBeenCalledExactlyOnceWith(CONVERSATION);
    expect(handlers.onDone).toHaveBeenCalledTimes(1);
    expect(handlers.onError).not.toHaveBeenCalled();
  });

  it("ignores comment lines such as the 15 second ping", async () => {
    const handlers = spies();
    await readConversationStream(
      streamOf(
        ": ping\n\n",
        ': ping\n\nevent: delta\ndata: {"text":"hi"}\n\n',
        "event: done\ndata: {}\n\n",
      ),
      handlers,
    );
    expect(handlers.onDelta.mock.calls).toEqual([["hi"]]);
    expect(handlers.onDone).toHaveBeenCalledTimes(1);
  });

  it("reassembles an event split across chunks", async () => {
    const handlers = spies();
    await readConversationStream(
      streamOf("event: de", 'lta\ndata: {"te', 'xt":"split"}', "\n\nevent: done\ndata: {}\n\n"),
      handlers,
    );
    expect(handlers.onDelta.mock.calls).toEqual([["split"]]);
    expect(handlers.onDone).toHaveBeenCalledTimes(1);
  });

  it("keeps an escaped newline inside a data line's JSON string", async () => {
    const handlers = spies();
    await readConversationStream(
      streamOf(
        'event: delta\ndata: {"text":"first line\\nsecond line"}\n\n',
        "event: done\ndata: {}\n\n",
      ),
      handlers,
    );
    expect(handlers.onDelta.mock.calls).toEqual([["first line\nsecond line"]]);
  });

  it("dispatches an error event instead of a state", async () => {
    const handlers = spies();
    await readConversationStream(
      streamOf(
        'event: delta\ndata: {"text":"Got it. "}\n\n',
        'event: error\ndata: {"code":"UPSTREAM_ERROR","message":"The assistant did not answer"}\n\n',
        "event: done\ndata: {}\n\n",
      ),
      handlers,
    );
    expect(handlers.onError).toHaveBeenCalledExactlyOnceWith({
      code: "UPSTREAM_ERROR",
      message: "The assistant did not answer",
    });
    expect(handlers.onState).not.toHaveBeenCalled();
    expect(handlers.onDone).toHaveBeenCalledTimes(1);
  });

  it("skips a frame with an unknown name or unparseable data", async () => {
    const handlers = spies();
    await readConversationStream(
      streamOf(
        "event: heartbeat\ndata: {}\n\n",
        "event: delta\ndata: not json\n\n",
        'event: delta\ndata: {"text":"ok"}\n\n',
        "event: done\ndata: {}\n\n",
      ),
      handlers,
    );
    expect(handlers.onDelta.mock.calls).toEqual([["ok"]]);
    expect(handlers.onDone).toHaveBeenCalledTimes(1);
  });

  it("dispatches a final frame that arrives without a trailing blank line", async () => {
    const handlers = spies();
    await readConversationStream(streamOf("event: done\ndata: {}"), handlers);
    expect(handlers.onDone).toHaveBeenCalledTimes(1);
  });
});
