import type { ThemePreference } from "@/api/models";
import { NativeSelect } from "@/components/native-select";
import { useThemePreference, useUpdateTheme } from "./hooks";
import { THEME_OPTIONS } from "./theme";

/** Light, dark, or system, saved to the account so the choice follows the user to another device. */
export function ThemeToggle() {
  const preference = useThemePreference();
  const update = useUpdateTheme();
  return (
    <NativeSelect
      aria-label="Theme"
      value={preference}
      disabled={update.isPending}
      onChange={(event) => update.mutate(event.target.value as ThemePreference)}
    >
      {THEME_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </NativeSelect>
  );
}
