import { Spinner } from "@/components/ui/spinner";

/** Shown while the session is being restored on load. The status keeps its name "Session" and its
 *  sentence (auth.test.tsx and AuthProvider rely on both); the spinner is decoration, hidden from
 *  the name, so a slow refresh reads as a load rather than a hung app. */
export function RestoringScreen() {
  return (
    <div
      role="status"
      aria-label="Session"
      aria-live="polite"
      className="grid min-h-svh place-items-center"
    >
      <div className="flex items-center gap-3">
        <Spinner aria-hidden="true" />
        <span>Restoring your session</span>
      </div>
    </div>
  );
}
