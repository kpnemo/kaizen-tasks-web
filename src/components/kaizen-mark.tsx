import { cn } from "@/lib/cn";

/** Three rising steps: small improvements, stacked. */
export function KaizenMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8", className)}>
      <path d="M4 28h8v-8H4zM12 20h8v-8h-8zM20 12h8V4h-8z" fill="currentColor" />
    </svg>
  );
}
