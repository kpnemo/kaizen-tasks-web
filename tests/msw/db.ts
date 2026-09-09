import type { Tag, TaskDetail, TaskSummary } from "@/api/models";
import { ISO } from "./fixtures";

/** A stored task row: everything on TaskDetail except the derived children, progress, and suggestionCount. */
export type Row = Omit<TaskDetail, "children" | "progress" | "suggestionCount">;

export const TAG_WORK = "tag-1";
export const TAG_HOME = "tag-2";
export const T_SUGGESTED = "t-1";
export const T_SKIPPED = "t-2";
export const T_FAILED = "t-3";

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

  reset() {
    const s = seed();
    this.rows = s.rows;
    this.tags = s.tags;
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
};
