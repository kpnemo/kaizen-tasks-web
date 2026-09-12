import { describe, expectTypeOf, it } from "vitest";
import type {
  AiSkipReason,
  AiStatus,
  Conversation,
  ConversationEvent,
  ConversationMessage,
  ConversationTurnBody,
  FeatureRequestBody,
  FeatureRequestDraft,
  RubricScore,
  SuggestionState,
  Tag,
  TaskDetail,
  TaskStatus,
  TaskSummary,
} from "./models";

describe("models derived from the contract", () => {
  it("match the API spec shapes", () => {
    expectTypeOf<TaskStatus>().toEqualTypeOf<"todo" | "in_progress" | "done">();
    expectTypeOf<AiStatus>().toEqualTypeOf<"pending" | "running" | "done" | "failed" | "skipped">();
    expectTypeOf<AiSkipReason>().toEqualTypeOf<
      "too_short" | "rate_limited" | "ai_disabled" | "no_steps_needed"
    >();
    expectTypeOf<SuggestionState>().toEqualTypeOf<"suggested" | "accepted" | "dismissed">();
    expectTypeOf<TaskDetail>().toExtend<TaskSummary>();
    expectTypeOf<TaskDetail["children"]>().toEqualTypeOf<TaskSummary[]>();
    expectTypeOf<TaskDetail["aiTagSuggestions"]>().toEqualTypeOf<string[]>();
    expectTypeOf<TaskSummary["progress"]>().toEqualTypeOf<{ done: number; total: number }>();
    // Rulings R1: the summary carries the suggestion count and the AI error.
    expectTypeOf<TaskSummary["suggestionCount"]>().toEqualTypeOf<number>();
    expectTypeOf<TaskSummary["aiError"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Tag>().toEqualTypeOf<{
      id: string;
      name: string;
      color: string;
      createdAt: string;
    }>();
  });
});

describe("conversation models derived from the contract", () => {
  it("match the interview contract (spec 3.2 and 3.3)", () => {
    expectTypeOf<Conversation["status"]>().toEqualTypeOf<
      "open" | "ready" | "filed" | "abandoned"
    >();
    expectTypeOf<Conversation["messages"]>().toEqualTypeOf<ConversationMessage[]>();
    expectTypeOf<Conversation["questionCount"]>().toEqualTypeOf<number>();
    expectTypeOf<Conversation["stillMissing"]>().toEqualTypeOf<string[]>();
    expectTypeOf<Conversation["issueNumber"]>().toEqualTypeOf<number | null>();
    expectTypeOf<ConversationMessage["role"]>().toEqualTypeOf<"assistant" | "user">();
    expectTypeOf<ConversationMessage["options"]>().toEqualTypeOf<string[] | undefined>();
    expectTypeOf<ConversationMessage["skipped"]>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<keyof FeatureRequestDraft>().toEqualTypeOf<
      "title" | "problem" | "proposedBehavior" | "acceptanceCriteria" | "outOfScope"
    >();
    expectTypeOf<FeatureRequestDraft["title"]>().toEqualTypeOf<string>();
    expectTypeOf<RubricScore["readiness"]>().toEqualTypeOf<number>();
    expectTypeOf<RubricScore["archChange"]>().toEqualTypeOf<boolean>();
    expectTypeOf<ConversationTurnBody["content"]>().toEqualTypeOf<string>();
    expectTypeOf<ConversationTurnBody["skip"]>().toEqualTypeOf<boolean | undefined>();
    // The stream's event union is discriminated on `event`, mirroring the wire format
    // `event: <name>\ndata: <json>` (spec 3.3).
    expectTypeOf<ConversationEvent["event"]>().toEqualTypeOf<
      "delta" | "state" | "error" | "done"
    >();
    expectTypeOf<Extract<ConversationEvent, { event: "delta" }>["data"]>().toEqualTypeOf<{
      text: string;
    }>();
    expectTypeOf<Extract<ConversationEvent, { event: "state" }>["data"]>().toEqualTypeOf<{
      conversation: Conversation;
    }>();
    expectTypeOf<
      Extract<ConversationEvent, { event: "error" }>["data"]["message"]
    >().toEqualTypeOf<string>();
    // The existing submit body carries the conversation (spec 3.2, row 4).
    expectTypeOf<FeatureRequestBody["conversationId"]>().toEqualTypeOf<string | undefined>();
  });
});
