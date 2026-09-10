import { beforeEach, describe, expect, it } from "vitest";
import { authStore } from "@/api/auth-store";
import { client, unwrap } from "@/api/client";
import { readConversationStream } from "@/api/conversation-stream";
import type { Conversation } from "@/api/models";
import { C_OPEN, db } from "./db";
import { demoUser, GREETING } from "./fixtures";

/** The five request fields, so the submit cases differ only in their `conversationId`. */
const FIVE = {
  title: "Snooze a task until a date",
  problem: "Tasks I cannot act on yet clutter the list.",
  proposedBehavior: "A snooze button hides the task until a date.",
  acceptanceCriteria: "It reappears on the chosen date.",
  outOfScope: "Recurring snoozes.",
};

type TurnResult = { deltas: string[]; state: Conversation | null; done: boolean; status: number };

/** Drives one turn through the typed client and the real parser, so the handlers are exercised the
 *  way the app uses them. A non-OK answer has no stream body; its status is returned instead.
 *  `seen` is an object rather than two `let`s because TypeScript does not track assignments made
 *  inside a callback. */
async function turn(id: string, content: string, skip = false): Promise<TurnResult> {
  const result = await client.POST("/feature-requests/conversation/{id}/messages", {
    params: { path: { id } },
    body: { content, skip },
    parseAs: "stream",
  });
  const deltas: string[] = [];
  const seen: { state: Conversation | null; done: boolean } = { state: null, done: false };
  const body = result.data;
  if (body) {
    await readConversationStream(body, {
      onDelta: (text) => deltas.push(text),
      onState: (conversation) => {
        seen.state = conversation;
      },
      onError: () => {},
      onDone: () => {
        seen.done = true;
      },
    });
  }
  return { deltas, state: seen.state, done: seen.done, status: result.response.status };
}

describe("conversation MSW handlers", () => {
  beforeEach(() => {
    authStore.setSession({ token: "test-token", user: demoUser });
  });

  it("404s before a conversation exists, then creates one with the greeting", async () => {
    const missing = await client.GET("/feature-requests/conversation");
    expect(missing.response.status).toBe(404);

    const created = unwrap(await client.POST("/feature-requests/conversation", {})).data;
    expect(created.status).toBe("open");
    expect(created.messages).toHaveLength(1);
    expect(created.messages[0]).toMatchObject({ role: "assistant", content: GREETING });

    const fetched = unwrap(await client.GET("/feature-requests/conversation")).data;
    expect(fetched.id).toBe(created.id);
  });

  it("streams deltas then a state carrying the new question and its options", async () => {
    const conversation = db.openConversation();
    const first = await turn(conversation.id, "I want to snooze tasks");
    expect(first.deltas.length).toBeGreaterThan(1);
    expect(first.done).toBe(true);
    expect(first.state?.questionCount).toBe(1);
    const last = first.state?.messages.at(-1);
    expect(last?.role).toBe("assistant");
    expect(last?.content).toBe(first.deltas.join(""));
    expect(last?.options).toHaveLength(3);
  });

  it("counts a skip and reaches ready on the fourth turn", async () => {
    const conversation = db.openConversation();
    await turn(conversation.id, "A supervisor before coaching");
    await turn(conversation.id, "(skipped)", true);
    const third = await turn(conversation.id, "The task leaves the list");
    expect(third.state?.questionCount).toBe(3);
    const fourth = await turn(conversation.id, "That is all");
    expect(fourth.state?.status).toBe("ready");
    expect(fourth.state?.score?.readiness).toBe(16);
    expect(fourth.state?.draft.acceptanceCriteria).not.toBe("");
    expect(fourth.state?.messages.some((m) => m.skipped === true)).toBe(true);
  });

  it("409s on a conversation that is no longer open and 404s on someone else's", async () => {
    const conversation = db.openConversation({ status: "ready" });
    expect((await turn(conversation.id, "hello")).status).toBe(409);
    expect((await turn("c-nope", "hello")).status).toBe(404);
  });

  it("marks the conversation filed when the request carries its id", async () => {
    const conversation = db.openConversation({ status: "ready" });
    const filed = unwrap(
      await client.POST("/feature-requests", {
        body: { ...FIVE, conversationId: conversation.id },
      }),
    ).data;
    expect(filed.issueNumber).toBe(42);
    expect(db.conversation?.status).toBe("filed");
    expect(db.conversation?.issueNumber).toBe(42);
  });

  it("rejects a conversation that cannot be attached", async () => {
    db.openConversation({ status: "filed", issueNumber: 7 });
    const conflict = await client.POST("/feature-requests", {
      body: { ...FIVE, conversationId: C_OPEN },
    });
    expect(conflict.response.status).toBe(409);

    db.openConversation({ status: "abandoned" });
    const abandoned = await client.POST("/feature-requests", {
      body: { ...FIVE, conversationId: C_OPEN },
    });
    expect(abandoned.response.status).toBe(409);

    db.openConversation();
    const someoneElse = await client.POST("/feature-requests", {
      body: { ...FIVE, conversationId: "c-not-mine" },
    });
    expect(someoneElse.response.status).toBe(404);
    expect(db.conversation?.status).toBe("open");
  });
});
