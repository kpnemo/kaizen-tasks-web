import { KaizenMark } from "@/components/kaizen-mark";

/** One quiet line at the bottom of every page: who this app was made for. */
export function WorkshopFooter() {
  return (
    <footer className="mx-auto w-full max-w-5xl px-6 py-6">
      <p className="flex items-center justify-center gap-2 border-t pt-6 text-sm text-muted-foreground">
        <KaizenMark className="size-4 text-primary" aria-hidden="true" />
        <span>
          Created for the <span className="font-semibold text-foreground/80">NICE</span> product
          workshop, September 2026
        </span>
      </p>
    </footer>
  );
}
