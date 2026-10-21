// Chips ("Chip"): rounded choices that wrap onto several lines, e.g. the
// portion ("100 g", "1 Becher (150 g)") and the meal on the Portion page.
// A radio group underneath; see radio-group.ts.
import { radioGroup, type RadioGroup, type RadioGroupOptions } from "./radio-group";

export type { Choice } from "./radio-group";

export function chipGroup<V extends string>(opts: RadioGroupOptions<V>): RadioGroup<V> {
  return radioGroup(opts, "chips");
}
