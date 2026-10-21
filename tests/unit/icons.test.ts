// src/ui/icons.ts holds a copy of the FigCraft icon export. This test reads
// the exported SVG files and checks that every icon is there with exactly
// the same drawing, so a redesigned icon cannot be forgotten in the code.
import { describe, expect, test } from "vitest";
import { ICON_PARTS, type IconName } from "../../src/ui/icons";

const files = import.meta.glob<string>("../../design/figcraft/export/icons/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});

// FigCraft file name → name in the code.
const NAMES: Record<string, IconName> = {
  aktivitaet: "activity",
  check: "check",
  einstellungen: "settings",
  export: "export",
  geraete: "devices",
  heute: "today",
  import: "import",
  info: "info",
  konto: "account",
  offline: "offline",
  plus: "plus",
  scan: "scan",
  schliessen: "close",
  schloss: "lock",
  statistik: "statistics",
  stift: "pencil",
  suche: "search",
  sync: "sync",
  weiter: "forward",
  woche: "week",
  ziel: "goal",
  zurueck: "back",
};

/** The parts of one exported SVG, in the shape of ICON_PARTS. */
function partsOf(svgText: string): { d: string; x: number; y: number; filled?: true }[] {
  const pattern =
    /<path transform="matrix\(1 0 0 1 ([\d.-]+) ([\d.-]+)\)" d="([^"]+)" fill="([^"]+)"/g;
  return [...svgText.matchAll(pattern)].map(([, x, y, d, fill]) => ({
    d: d ?? "",
    x: Number(x),
    y: Number(y),
    ...(fill !== "none" && { filled: true as const }),
  }));
}

describe("icons", () => {
  const entries = Object.entries(files).map(([path, text]) => {
    const base = /([\w-]+)\.svg$/.exec(path)?.[1] ?? "";
    return [base, text] as const;
  });

  test("every exported icon has a name, and nothing else exists", () => {
    expect(entries.length).toBeGreaterThanOrEqual(17);
    expect(entries.map(([base]) => base).sort()).toEqual(Object.keys(NAMES).sort());
    expect(Object.keys(ICON_PARTS).sort()).toEqual(Object.values(NAMES).sort());
  });

  test.each(entries)("%s.svg matches the code", (base, text) => {
    const name = NAMES[base];
    if (name === undefined) throw new Error(`no name for ${base}`);
    const parts = partsOf(text);
    expect(parts.length).toBeGreaterThan(0);
    expect(ICON_PARTS[name]).toEqual(parts);
  });
});
