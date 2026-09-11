import { Check } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { TAG_PALETTE } from "@/lib/tag-palette";

/** The palette as a radio group: one round swatch per colour, the chosen one wearing a check mark
 *  and a foreground border so the choice never rests on hue alone. Radix owns the roving focus and
 *  the arrow keys. The group is named either directly (`aria-label`, inside a row's popover) or by
 *  the create form's legend (`aria-labelledby`). */
export function ColorPicker({
  value,
  onChange,
  ...labelling
}: {
  value: string;
  onChange: (color: string) => void;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  // Colours reach here from the API as well as the palette, so match them case-insensitively and
  // hand Radix the palette's own spelling.
  const selected =
    TAG_PALETTE.find((color) => color.value.toUpperCase() === value.toUpperCase())?.value ?? "";
  return (
    <RadioGroup
      value={selected}
      onValueChange={onChange}
      className="flex flex-wrap gap-2"
      {...labelling}
    >
      {TAG_PALETTE.map((color) => (
        <RadioGroupItem
          key={color.value}
          value={color.value}
          aria-label={color.name}
          className="grid size-11 place-items-center border-border text-white data-[state=checked]:border-2 data-[state=checked]:border-foreground"
          style={{ backgroundColor: color.value }}
        >
          <Check aria-hidden="true" />
        </RadioGroupItem>
      ))}
    </RadioGroup>
  );
}
