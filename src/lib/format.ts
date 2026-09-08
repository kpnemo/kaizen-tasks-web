import type { AiSkipReason } from "@/api/models";

const SKIP_LABELS: Record<AiSkipReason, string> = {
  too_short: "Too short to break down",
  rate_limited: "Hourly limit reached",
  ai_disabled: "Assistant paused",
};

/** The skip reason in words (spec 4.3). */
export function skipReasonLabel(reason: AiSkipReason | null | undefined): string {
  return reason ? SKIP_LABELS[reason] : "Skipped";
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
