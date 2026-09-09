import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { TAG_PALETTE } from "@/lib/tag-palette";

export function ColorPicker({
  value,
  onChange,
  label = "Color",
}: {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {TAG_PALETTE.map((color) => {
        const selected = color.value.toUpperCase() === value.toUpperCase();
        return (
          <button
            key={color.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color.name}
            onClick={() => onChange(color.value)}
            className={cn(
              "grid size-11 place-items-center rounded-full border-4 text-white",
              selected ? "border-foreground" : "border-transparent",
            )}
            style={{ backgroundColor: color.value }}
          >
            {selected ? <Check className="size-5" aria-hidden="true" /> : null}
          </button>
        );
      })}
    </div>
  );
}
