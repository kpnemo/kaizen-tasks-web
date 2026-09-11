import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import type { ThemePreference } from "@/api/models";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useThemePreference, useUpdateTheme } from "./hooks";
import { THEME_OPTIONS } from "./theme";

const ICONS: Record<ThemePreference, LucideIcon> = { light: Sun, dark: Moon, system: Monitor };

/** Light, dark, or system, saved to the account so the choice follows the user to another device.
 *  A menu rather than a native select: the trigger shows the current choice as its icon (and its
 *  word from `xl` up, where the header has room beside the three nav labels and the display name;
 *  at the projector's 1024px the word would wrap the wordmark), each item carries an icon and its
 *  word, and the open menu is part of the page, so it reads on a projector and lands in a
 *  screenshot. The trigger keeps the accessible name "Theme". */
export function ThemeToggle() {
  const preference = useThemePreference();
  const update = useUpdateTheme();
  const current = THEME_OPTIONS.find((option) => option.value === preference) ?? THEME_OPTIONS[0];
  const CurrentIcon = ICONS[current.value];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" aria-label="Theme" disabled={update.isPending}>
          <CurrentIcon data-icon="inline-start" aria-hidden="true" />
          <span className="hidden xl:inline">{current.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(value) => update.mutate(value as ThemePreference)}
        >
          {THEME_OPTIONS.map((option) => {
            const Icon = ICONS[option.value];
            return (
              <DropdownMenuRadioItem
                key={option.value}
                value={option.value}
                className="min-h-11 text-base"
              >
                <Icon aria-hidden="true" />
                {option.label}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
