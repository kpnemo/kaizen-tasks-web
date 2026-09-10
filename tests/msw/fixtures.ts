import type { Conversation, ConversationMessage, FeatureRequestDraft, User } from "@/api/models";

export const ISO = "2026-09-01T09:00:00.000Z";

export const demoUser: User = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "demo@kaizen.local",
  displayName: "Demo",
  createdAt: ISO,
};

/** The fixed first assistant message the API writes with no model call (spec 2, "Start"). */
export const GREETING =
  "Tell me the idea in a sentence or two: who has the problem and what would be different.";

export const EMPTY_DRAFT: FeatureRequestDraft = {
  title: "",
  problem: "",
  proposedBehavior: "",
  acceptanceCriteria: "",
  outOfScope: "",
};

export function makeMessage(
  overrides: Partial<ConversationMessage> & Pick<ConversationMessage, "id" | "role" | "content">,
): ConversationMessage {
  return { at: ISO, ...overrides };
}

/** A fresh open conversation: the greeting, an empty draft, no score. */
export function makeConversation(
  overrides: Partial<Conversation> & Pick<Conversation, "id">,
): Conversation {
  return {
    status: "open",
    messages: [makeMessage({ id: "m-greeting", role: "assistant", content: GREETING })],
    draft: EMPTY_DRAFT,
    score: null,
    questionCount: 0,
    stillMissing: [],
    issueNumber: null,
    createdAt: ISO,
    updatedAt: ISO,
    ...overrides,
  };
}
