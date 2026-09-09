import { Check } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";
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
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = TAG_PALETTE.findIndex(
    (color) => color.value.toUpperCase() === value.toUpperCase(),
  );
  // The roving tab stop: the checked radio, or the first when none is checked.
  const activeIndex = selectedIndex === -1 ? 0 : selectedIndex;

  /** Selects the palette color at `index` (wrapping) and moves focus to its radio. */
  function moveTo(index: number) {
    const wrapped = (index + TAG_PALETTE.length) % TAG_PALETTE.length;
    onChange(TAG_PALETTE[wrapped].value);
    radioRefs.current[wrapped]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        moveTo(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        moveTo(index - 1);
        break;
      case "Home":
        event.preventDefault();
        moveTo(0);
        break;
      case "End":
        event.preventDefault();
        moveTo(TAG_PALETTE.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {TAG_PALETTE.map((color, index) => {
        const selected = color.value.toUpperCase() === value.toUpperCase();
        return (
          <button
            key={color.value}
            ref={(el) => {
              radioRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color.name}
            tabIndex={index === activeIndex ? 0 : -1}
            onClick={() => onChange(color.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
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
