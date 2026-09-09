import { describe, expectTypeOf, it } from "vitest";
import type {
  AiSkipReason,
  AiStatus,
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
    expectTypeOf<AiSkipReason>().toEqualTypeOf<"too_short" | "rate_limited" | "ai_disabled">();
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
