// A group of choices where exactly one can be picked, built from real radio
// buttons: <fieldset><legend> + <input type="radio"> + <label>.
//
// Why real radios instead of styled <div>s or buttons: the browser gives us
// arrow-key navigation, "1 von 4" announcements in screen readers and form
// behaviour for free. The radio circle itself is hidden (but still
// focusable); the <label> is styled as a chip or a segment, and CSS draws
// the focus ring on the label when the radio has keyboard focus.
//
// Used by chip-group.ts and segmented.ts, which only add their look.
import { el, uniqueId } from "./dom";

export interface Choice<V extends string> {
  value: V;
  label: string;
}

export interface RadioGroupOptions<V extends string> {
  /** The question ("Mahlzeit"). Always in the page for screen readers. */
  legend: string;
  /** false: the legend is only for screen readers (the screen shows it elsewhere). */
  legendVisible?: boolean;
  choices: readonly Choice<V>[];
  /** The selected value; `null` for "nothing chosen yet". */
  value?: V | null;
  /** Shared `name` of the radios; generated if left out. */
  name?: string;
}

export interface RadioGroup<V extends string> {
  element: HTMLFieldSetElement;
  value: () => V | null;
  /** Selects `value` (or nothing for `null`) without firing `onChange`. */
  setValue: (value: V | null) => void;
  /** Called when the user picks a choice. */
  onChange: (listener: (value: V) => void) => void;
}

export function radioGroup<V extends string>(
  opts: RadioGroupOptions<V>,
  className: string,
): RadioGroup<V> {
  const name = opts.name ?? uniqueId("choice");
  const listeners: ((value: V) => void)[] = [];

  const radios = opts.choices.map((choice) => {
    const id = uniqueId(name);
    const radio = el("input", {
      type: "radio",
      name,
      id,
      value: choice.value,
      class: `${className}__radio`,
    });
    radio.checked = choice.value === opts.value;
    radio.addEventListener("change", () => {
      if (radio.checked) for (const listener of listeners) listener(choice.value);
    });
    const label = el("label", { for: id, class: `${className}__option` }, [choice.label]);
    return { choice, radio, nodes: [radio, label] };
  });

  const legend = el(
    "legend",
    { class: opts.legendVisible === false ? "visually-hidden" : `${className}__legend` },
    [opts.legend],
  );

  const element = el("fieldset", { class: className }, [
    legend,
    el(
      "div",
      { class: `${className}__options` },
      radios.flatMap((r) => r.nodes),
    ),
  ]);

  return {
    element,
    value: () => radios.find((r) => r.radio.checked)?.choice.value ?? null,
    setValue: (value) => {
      for (const r of radios) r.radio.checked = r.choice.value === value;
    },
    onChange: (listener) => {
      listeners.push(listener);
    },
  };
}
