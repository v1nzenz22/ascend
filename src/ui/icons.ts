// The app's icons, drawn as inline SVG.
//
// The path data is copied from the FigCraft export in
// design/figcraft/export/icons/*.svg (24 × 24, 1.5 px strokes). Each part
// keeps the offset FigCraft gave it, written as a `translate`.
// tests/unit/icons.test.ts checks that this file still matches the export,
// so a redesigned icon cannot be forgotten here.
//
// Why inline SVG built in code (and not <img src="icon.svg">): only inline
// SVG can use `currentColor`, so icons take the text colour of their link
// or button and follow the light/dark theme and the active state for free.

import { svg } from "./dom";

/** One drawn part of an icon. `filled` parts are solid dots, the rest are lines. */
interface IconPart {
  d: string;
  x: number;
  y: number;
  filled?: true;
}

// English names; the FigCraft file name is noted above each icon.
const ICONS = {
  // aktivitaet.svg
  activity: [{ d: "M0 5L4.5 5L6.5 0L10.5 10L12.5 5L17 5", x: 3.5, y: 7 }],
  // check.svg
  check: [{ d: "M0 5.5L5 10.5L14 0", x: 5, y: 7 }],
  // einstellungen.svg
  settings: [
    { d: "M0 0L3 0M7 0L16 0M0 9L9 9M13 9L16 9", x: 4, y: 7.5 },
    {
      d: "M3.25 2C3.25 2.69 2.69 3.25 2 3.25C1.31 3.25 0.75 2.69 0.75 2C0.75 1.31 1.31 0.75 2 0.75C2.69 0.75 3.25 1.31 3.25 2",
      x: 7,
      y: 5.5,
    },
    {
      d: "M3.25 2C3.25 2.69 2.69 3.25 2 3.25C1.31 3.25 0.75 2.69 0.75 2C0.75 1.31 1.31 0.75 2 0.75C2.69 0.75 3.25 1.31 3.25 2",
      x: 13,
      y: 14.5,
    },
  ],
  // export.svg
  export: [{ d: "M7 0L7 10.5M3 6.5L7 10.5L11 6.5M0 15L14 15", x: 5, y: 4 }],
  // geraete.svg
  devices: [
    {
      d: "M2.5 3.5L3 0L7 0L7.5 3.5M2.5 13.5L3 17L7 17L7.5 13.5M2.5 8.5L3.8 8.5L4.8 6.5L5.8 10.5L6.8 8.5L7.5 8.5M2 3.5L8 3.5C9.333 3.5 10 4.167 10 5.5L10 11.5C10 12.833 9.333 13.5 8 13.5L2 13.5C0.667 13.5 0 12.833 0 11.5L0 5.5C0 4.167 0.667 3.5 2 3.5Z",
      x: 7,
      y: 3.5,
    },
  ],
  // heute.svg
  today: [
    { d: "M0 6.5L15 6.5M4 0L4 4M11 0L11 4M0 2.5L15 2.5L15 15.5L0 15.5L0 2.5Z", x: 4.5, y: 4 },
  ],
  // import.svg
  import: [{ d: "M7 10.5L7 0M3 4L7 0L11 4M0 15L14 15", x: 5, y: 4 }],
  // info.svg
  info: [
    {
      d: "M16.25 8.5C16.25 12.78 12.78 16.25 8.5 16.25C4.22 16.25 0.75 12.78 0.75 8.5C0.75 4.22 4.22 0.75 8.5 0.75C12.78 0.75 16.25 4.22 16.25 8.5",
      x: 3.5,
      y: 3.5,
    },
    { d: "M0 0L0 5.5", x: 12, y: 11 },
    {
      d: "M2 1C2 1.552 1.552 2 1 2C0.448 2 0 1.552 0 1C0 0.448 0.448 0 1 0C1.552 0 2 0.448 2 1",
      x: 11,
      y: 7,
      filled: true,
    },
  ],
  // konto.svg
  account: [
    {
      d: "M6.25 3.5C6.25 5.019 5.019 6.25 3.5 6.25C1.981 6.25 0.75 5.019 0.75 3.5C0.75 1.981 1.981 0.75 3.5 0.75C5.019 0.75 6.25 1.981 6.25 3.5",
      x: 8.5,
      y: 5,
    },
    { d: "M0 4.5C4.667 -1.5 9.333 -1.5 14 4.5", x: 5, y: 15 },
  ],
  // offline.svg
  offline: [
    {
      d: "M0 0L16 16M0.5 5.5C5.5 1.167 10.5 1.167 15.5 5.5M3.5 9C6.5 6.667 9.5 6.667 12.5 9",
      x: 4,
      y: 4,
    },
    {
      d: "M2.6 1.3C2.6 2.018 2.018 2.6 1.3 2.6C0.582 2.6 0 2.018 0 1.3C0 0.582 0.582 0 1.3 0C2.018 0 2.6 0.582 2.6 1.3",
      x: 10.7,
      y: 15.7,
      filled: true,
    },
  ],
  // plus.svg
  plus: [{ d: "M7 0L7 14M0 7L14 7", x: 5, y: 5 }],
  // scan.svg
  scan: [
    {
      d: "M0 4L0 0L4 0M12 0L16 0L16 4M16 11L16 15L12 15M4 15L0 15L0 11M4 4.5L4 10.5M7 4.5L7 10.5M10 4.5L10 10.5M12.5 4.5L12.5 10.5",
      x: 4,
      y: 4.5,
    },
  ],
  // schliessen.svg
  close: [{ d: "M0 0L11 11M11 0L0 11", x: 6.5, y: 6.5 }],
  // schloss.svg
  lock: [
    {
      d: "M2 4.75L2 2.25C4 -0.75 6 -0.75 8 2.25L8 4.75M0 4.75L10 4.75L10 12.75L0 12.75L0 4.75Z",
      x: 7,
      y: 6.25,
    },
  ],
  // statistik.svg
  statistics: [
    { d: "M0 12L16 12M1.5 8L6 3L9.5 6L15 0", x: 4, y: 7.5 },
    {
      d: "M2.4 1.2C2.4 1.863 1.863 2.4 1.2 2.4C0.537 2.4 0 1.863 0 1.2C0 0.537 0.537 0 1.2 0C1.863 0 2.4 0.537 2.4 1.2",
      x: 17.8,
      y: 6.3,
      filled: true,
    },
  ],
  // stift.svg
  pencil: [{ d: "M8.5 2L11.5 5M0 13.5L1 9.5L10.5 0L13.5 3L4 12.5L0 13.5Z", x: 5, y: 5.5 }],
  // suche.svg
  search: [
    {
      d: "M11.25 6C11.25 8.899 8.899 11.25 6 11.25C3.101 11.25 0.75 8.899 0.75 6C0.75 3.101 3.101 0.75 6 0.75C8.899 0.75 11.25 3.101 11.25 6",
      x: 4.5,
      y: 4.5,
    },
    { d: "M0 0L5 5", x: 15, y: 15 },
  ],
  // sync.svg
  sync: [
    {
      d: "M0 6C0.667 2.333 2.833 0.5 6.5 0.5C8.833 0.5 10.667 1.5 12 3.5M12 0L12 3.5L8.5 3.5M13 8C12.333 11.667 10.167 13.5 6.5 13.5C4.167 13.5 2.333 12.5 1 10.5M1 14L1 10.5L4.5 10.5",
      x: 5.5,
      y: 5,
    },
  ],
  // weiter.svg
  forward: [{ d: "M0 0L6 6L0 12", x: 9.5, y: 6 }],
  // woche.svg
  week: [{ d: "M0 13L0 6M6 13L6 0M12 13L12 8", x: 6, y: 6 }],
  // ziel.svg
  goal: [
    {
      d: "M16.25 8.5C16.25 12.78 12.78 16.25 8.5 16.25C4.22 16.25 0.75 12.78 0.75 8.5C0.75 4.22 4.22 0.75 8.5 0.75C12.78 0.75 16.25 4.22 16.25 8.5",
      x: 3.5,
      y: 3.5,
    },
    {
      d: "M8.25 4.5C8.25 6.571 6.571 8.25 4.5 8.25C2.429 8.25 0.75 6.571 0.75 4.5C0.75 2.429 2.429 0.75 4.5 0.75C6.571 0.75 8.25 2.429 8.25 4.5",
      x: 7.5,
      y: 7.5,
    },
    {
      d: "M2.4 1.2C2.4 1.863 1.863 2.4 1.2 2.4C0.537 2.4 0 1.863 0 1.2C0 0.537 0.537 0 1.2 0C1.863 0 2.4 0.537 2.4 1.2",
      x: 10.8,
      y: 10.8,
      filled: true,
    },
  ],
  // zurueck.svg
  back: [{ d: "M7 0L0 7L7 14", x: 8, y: 5 }],
} as const satisfies Record<string, readonly IconPart[]>;

export type IconName = keyof typeof ICONS;

/** The drawing data of every icon (read by the unit test). */
export const ICON_PARTS: Readonly<Record<IconName, readonly IconPart[]>> = ICONS;

/**
 * An icon as an <svg> element. Always decorative (`aria-hidden`): the
 * meaning comes from the visible label next to it or from the `aria-label`
 * of the icon-only button that contains it.
 */
export function icon(name: IconName, className = "icon"): SVGSVGElement {
  const parts: readonly IconPart[] = ICONS[name];
  const paths = parts.map((part) =>
    svg("path", {
      d: part.d,
      transform: `translate(${String(part.x)} ${String(part.y)})`,
      // Lines use the stroke settings of the <svg>; dots are filled instead.
      ...(part.filled === true && { fill: "currentColor", stroke: "none" }),
    }),
  );
  return svg(
    "svg",
    {
      class: className,
      viewBox: "0 0 24 24",
      width: 24,
      height: 24,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 1.5,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
      // Old Edge/IE made every SVG a tab stop; harmless elsewhere.
      focusable: "false",
    },
    paths,
  );
}
