import type {
  Conversation,
  ConversationMessage,
  FeatureRequestDraft,
  RubricScore,
  Tag,
  TaskDetail,
  TaskSummary,
} from "@/api/models";
import { ISO, makeConversation, makeMessage } from "./fixtures";

/** A stored task row: everything on TaskDetail except the derived children, progress, and suggestionCount. */
export type Row = Omit<TaskDetail, "children" | "progress" | "suggestionCount">;

export const TAG_WORK = "tag-1";
export const TAG_HOME = "tag-2";
export const T_SUGGESTED = "t-1";
export const T_SKIPPED = "t-2";
export const T_FAILED = "t-3";
export const T_NO_STEPS = "t-4";

let counter = 100;
export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export function makeTag(overrides: Partial<Tag> & Pick<Tag, "id" | "name">): Tag {
  return { color: "#3B3FBF", createdAt: ISO, ...overrides };
}

/** A root task row with sensible defaults (AI done, no error, no suggestions). */
export function makeTask(overrides: Partial<Row> & Pick<Row, "id" | "title">): Row {
  return {
    parentId: null,
    description: null,
    status: "todo",
    aiStatus: "done",
    aiSkipReason: null,
    position: 0,
    origin: "user",
    suggestionState: null,
    rationale: null,
    tags: [],
    createdAt: ISO,
    updatedAt: ISO,
    aiTagSuggestions: [],
    aiError: null,
    ...overrides,
  };
}

/** A child row; AI-origin and suggested unless overridden. */
export function makeStep(overrides: Partial<Row> & Pick<Row, "id" | "parentId" | "title">): Row {
  return makeTask({
    aiStatus: "skipped",
    origin: "ai",
    suggestionState: "suggested",
    rationale: "It is the first physical action and everything else depends on it.",
    ...overrides,
  });
}

export function progressOf(children: Row[]): { done: number; total: number } {
  const counted = children.filter((c) => c.origin === "user" || c.suggestionState === "accepted");
  return { done: counted.filter((c) => c.status === "done").length, total: counted.length };
}

function byPosition(a: Row, b: Row) {
  return (
    a.position - b.position || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
  );
}

export const C_OPEN = "c-1";

/** The scripted interview the API's fake adapter serves (spec 3.4), so the web tests exercise the
 *  same four turns staging serves with AI_MODEL_PROVIDER=fake. */
const TURNS: {
  reply: string;
  options: string[];
  recommended: string;
  draft: Partial<FeatureRequestDraft>;
}[] = [
  {
    reply: "Got it. Who has this problem, and when does it come up?",
    options: [
      "A team supervisor before a coaching session",
      "An agent during a call",
      "A workforce planner on Monday",
    ],
    recommended: "A team supervisor before a coaching session",
    draft: { title: "Snooze a task until a date" },
  },
  {
    reply: "Thanks. What would you see on screen that you cannot see today?",
    options: [
      "A snooze control on each task",
      "A filter that hides snoozed tasks",
      "A date picker in the row",
    ],
    recommended: "A snooze control on each task",
    draft: { problem: "Tasks I cannot act on yet clutter the list." },
  },
  {
    reply: "Good. Name one thing you could check to say this works.",
    options: [
      "A snoozed task leaves the list",
      "It reappears on the chosen date",
      "The header count drops",
    ],
    recommended: "A snoozed task leaves the list",
    draft: { proposedBehavior: "A snooze button hides the task until a date." },
  },
];

const READY_REPLY = "That is enough to file. The request reads as ready.";

const READY_DRAFT: FeatureRequestDraft = {
  title: "Snooze a task until a date",
  problem: "Tasks I cannot act on yet clutter the list.",
  proposedBehavior: "A snooze button hides the task until a date.",
  acceptanceCriteria:
    "- A snoozed task leaves the list\n- It reappears on the chosen date\n- The header count drops",
  outOfScope: "Recurring snoozes.",
};

const READY_SCORE: RubricScore = {
  clarity: 4,
  complexity: 2,
  risk: 2,
  archChange: false,
  readiness: 16,
  reasons: {
    clarity: "The user, the moment, and three checkable criteria are named.",
    complexity: "One list view and one new field.",
    risk: "No data migration and no new integration.",
  },
};

/** Two chunks per reply, so a test can watch the text grow. */
function splitReply(reply: string): string[] {
  const cut = reply.indexOf(" ") + 1;
  return [reply.slice(0, cut), reply.slice(cut)];
}

function seed(): { rows: Row[]; tags: Tag[] } {
  const work = makeTag({ id: TAG_WORK, name: "work", color: "#3B3FBF" });
  const home = makeTag({ id: TAG_HOME, name: "home", color: "#2F7D4F" });
  const rows: Row[] = [
    makeTask({
      id: T_SUGGESTED,
      title: "Prepare the quarterly business review deck",
      description: "For the leadership team on the 30th.",
      tags: [work],
      aiTagSuggestions: ["planning"],
    }),
    makeStep({
      id: "s-1",
      parentId: T_SUGGESTED,
      title: "List the three decisions the deck must drive",
      position: 0,
      rationale: "Everything else follows from what the room must decide.",
    }),
    makeStep({
      id: "s-2",
      parentId: T_SUGGESTED,
      title: "Pull last quarter's numbers from the dashboard",
      position: 1,
      rationale: "The numbers gate every other slide.",
    }),
    makeStep({
      id: "s-3",
      parentId: T_SUGGESTED,
      title: "Draft the outline",
      position: 2,
      rationale: "An outline makes the review cheap.",
    }),
    makeStep({
      id: "s-4",
      parentId: T_SUGGESTED,
      title: "Book the rehearsal slot",
      position: 3,
      origin: "user",
      suggestionState: null,
      rationale: null,
    }),
    makeTask({
      id: T_SKIPPED,
      title: "Buy milk",
      aiStatus: "skipped",
      aiSkipReason: "too_short",
      tags: [home],
    }),
    makeTask({
      id: T_NO_STEPS,
      title: "Water the office plants",
      aiStatus: "skipped",
      aiSkipReason: "no_steps_needed",
    }),
    makeTask({
      id: T_FAILED,
      title: "Plan the team offsite agenda",
      aiStatus: "failed",
      aiError: "The assistant is unavailable, try again",
    }),
  ];
  return { rows, tags: [work, home] };
}

export const db = {
  rows: [] as Row[],
  tags: [] as Tag[],
  conversation: null as Conversation | null,

  reset() {
    const s = seed();
    this.rows = s.rows;
    this.tags = s.tags;
    this.conversation = null;
    counter = 100;
  },
  find(id: string): Row | undefined {
    return this.rows.find((r) => r.id === id);
  },
  children(parentId: string): Row[] {
    return this.rows.filter((r) => r.parentId === parentId).sort(byPosition);
  },
  /** TaskSummary = the row minus the detail-only aiTagSuggestions, plus the derived suggestionCount and progress (R1). */
  summary(row: Row): TaskSummary {
    const { aiTagSuggestions, ...rest } = row;
    void aiTagSuggestions; // detail-only field, dropped from the summary
    const children = this.children(row.id);
    return {
      ...rest,
      suggestionCount: children.filter((c) => c.suggestionState === "suggested").length,
      progress: progressOf(children),
    };
  },
  detail(id: string): TaskDetail | undefined {
    const row = this.find(id);
    if (!row) return undefined;
    return {
      ...this.summary(row),
      children: this.children(id).map((c) => this.summary(c)),
      aiTagSuggestions: row.aiTagSuggestions,
    };
  },
  /** Moves a row to the target index among its siblings and renumbers positions densely. */
  move(row: Row, targetIndex: number) {
    const siblings = this.children(row.parentId ?? "").filter((r) => r.id !== row.id);
    const index = Math.max(0, Math.min(targetIndex, siblings.length));
    siblings.splice(index, 0, row);
    siblings.forEach((r, i) => {
      r.position = i;
    });
  },
  remove(id: string) {
    const doomed = new Set([id, ...this.children(id).map((c) => c.id)]);
    this.rows = this.rows.filter((r) => !doomed.has(r.id));
  },
  /** Seeds the caller's open conversation, as GET returns it after the API created one. */
  openConversation(overrides: Partial<Conversation> = {}): Conversation {
    const conversation = makeConversation({ id: C_OPEN, ...overrides });
    this.conversation = conversation;
    return conversation;
  },
  /** POST /feature-requests/conversation: abandons an open or ready one, then creates a new one. */
  startConversation(): Conversation {
    const conversation = makeConversation({ id: nextId("c") });
    this.conversation = conversation;
    return conversation;
  },
  /** One turn of the scripted interview; returns the deltas to stream and the persisted state.
   *  A finishing turn records the PM's own words and answers with the ready branch, asking nothing
   *  more, so `questionCount` stays where it was. */
  advanceTurn(
    content: string,
    flags: { skip: boolean; finish: boolean },
  ): { deltas: string[]; conversation: Conversation } {
    const current = this.conversation;
    if (!current) throw new Error("advanceTurn: no conversation");
    const asked: ConversationMessage[] = [
      ...current.messages,
      flags.finish
        ? makeMessage({
            id: nextId("m"),
            role: "user",
            content: "Finish with what we have",
            finished: true,
          })
        : makeMessage({
            id: nextId("m"),
            role: "user",
            content: flags.skip ? "(skipped)" : content,
            skipped: flags.skip,
          }),
    ];
    const step = flags.finish ? undefined : TURNS[current.questionCount];
    const now = new Date().toISOString();
    const conversation: Conversation = step
      ? {
          ...current,
          messages: [
            ...asked,
            makeMessage({
              id: nextId("m"),
              role: "assistant",
              content: step.reply,
              options: step.options,
              recommended: step.recommended,
            }),
          ],
          draft: { ...current.draft, ...step.draft },
          questionCount: current.questionCount + 1,
          updatedAt: now,
        }
      : {
          ...current,
          status: "ready",
          messages: [
            ...asked,
            makeMessage({ id: nextId("m"), role: "assistant", content: READY_REPLY }),
          ],
          draft: READY_DRAFT,
          score: READY_SCORE,
          stillMissing: [],
          updatedAt: now,
        };
    this.conversation = conversation;
    return { deltas: splitReply(step ? step.reply : READY_REPLY), conversation };
  },
};
