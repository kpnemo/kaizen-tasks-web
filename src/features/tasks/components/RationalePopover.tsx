import { Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

/** "Suggested by AI" badge. The rationale shows while hovering and pins on tap or click, so
 *  nothing the demo depends on is hover-only. Once a click sets `pinned`, it wins over hover:
 *  hovering or leaving has no effect on visibility until the next click (a user who hovers,
 *  clicks to pin, then clicks again to close is still hovering the whole time, so `open` must
 *  be driven by the click rather than derived from `hover || pinned`).
 *
 *  The badge is a plain `PopoverAnchor`, not a `PopoverTrigger`, because visibility is driven by
 *  our own state rather than Radix's built-in toggle. Radix's non-modal content only exempts its
 *  own registered *trigger* ref from "click outside" dismissal, so a plain anchor's own click
 *  would otherwise read as an outside interaction and close the content on the same click that
 *  opened it; `onInteractOutside` below exempts our anchor explicitly. */
export function RationalePopover({ rationale }: { rationale: string | null }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setOpen(false);
          setPinned(false);
        }
      }}
    >
      <PopoverAnchor asChild>
        <button
          ref={anchorRef}
          type="button"
          aria-expanded={open}
          onClick={() =>
            setPinned((was) => {
              const next = !was;
              setOpen(next);
              return next;
            })
          }
          onPointerEnter={() => {
            if (!pinned) setOpen(true);
          }}
          onPointerLeave={() => {
            if (!pinned) setOpen(false);
          }}
          className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground"
        >
          <Sparkles className="size-4" aria-hidden="true" />
          Suggested by AI
        </button>
      </PopoverAnchor>
      <PopoverContent
        className="w-80 text-base"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (anchorRef.current?.contains(e.target as Node)) e.preventDefault();
        }}
      >
        <p className="font-semibold">Why this step</p>
        <p className="mt-1">{rationale ?? "No rationale was given."}</p>
      </PopoverContent>
    </Popover>
  );
}
