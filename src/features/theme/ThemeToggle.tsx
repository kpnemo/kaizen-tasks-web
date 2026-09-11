import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import type { ThemePreference } from "@/api/models";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useThemePreference, useUpdateTheme } from "./hooks";
import { THEME_OPTIONS } from "./theme";

const ICONS: Record<ThemePreference, LucideIcon> = { light: Sun, dark: Moon, system: Monitor };

/** Cycles light, dark, then system on each click, in `THEME_OPTIONS`'s order, and saves the
 *  choice to the account (ADR 0006). Icon-only: the accessible name states the current mode and
 *  what one more click switches to, so the state is available without a visible word. */
export function ThemeToggle() {
  const preference = useThemePreference();
  const update = useUpdateTheme();
  const currentIndex = Math.max(
    0,
    THEME_OPTIONS.findIndex((option) => option.value === preference),
  );
  const current = THEME_OPTIONS[currentIndex];
  const next = THEME_OPTIONS[(currentIndex + 1) % THEME_OPTIONS.length];
  const CurrentIcon = ICONS[current.value];
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={`Theme: ${current.label}, switch to ${next.label}`}
      disabled={update.isPending}
      onClick={() => update.mutate(next.value)}
    >
      {update.isPending ? <Spinner aria-hidden="true" /> : <CurrentIcon aria-hidden="true" />}
    </Button>
  );
}
