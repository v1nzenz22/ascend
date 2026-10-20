// Record IDs. UUIDs are unique across devices, so exports from two devices
// can later be merged without renumbering. Kept in its own module so tests
// can stub it (`vi.mock`) for predictable IDs.
//
// `crypto.randomUUID()` needs a secure context (https:// or localhost),
// which a PWA needs anyway for its service worker.

export function newId(): string {
  return crypto.randomUUID();
}
