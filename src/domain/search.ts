// Local search over the user's own foods. Runs in memory: no network.

/**
 * Text in a form that ignores case and accents: lower case (German rules),
 * then accents split off (NFD) and removed. "Müsli" and "müsli" both become
 * "musli". "Muesli" stays different – spelling variants are not guessed.
 */
export function normalizeForSearch(s: string): string {
  return (
    s
      .toLocaleLowerCase("de")
      .normalize("NFD")
      // \p{M} = combining marks, e.g. the two dots of "ü" after NFD.
      .replace(/\p{M}/gu, "")
      .trim()
  );
}

/** What the search needs from a food. Generic so callers keep their type. */
interface Searchable {
  name: string;
  brand?: string;
}

/**
 * The foods whose name or brand contains `query` (normalised, see above).
 * An empty query returns all foods. Order is kept; the input is not changed.
 */
export function matchFoods<T extends Searchable>(foods: readonly T[], query: string): T[] {
  const needle = normalizeForSearch(query);
  if (needle === "") return [...foods];
  return foods.filter(
    (food) =>
      normalizeForSearch(food.name).includes(needle) ||
      (food.brand !== undefined && normalizeForSearch(food.brand).includes(needle)),
  );
}
