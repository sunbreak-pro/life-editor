/**
 * Return a new Set with `member` toggled — removed if present, added if not.
 * The immutable `setX((prev) => toggleSetMember(prev, id))` pattern was
 * hand-rolled at several call sites (task links / expand, schedule selection).
 */
export function toggleSetMember<T>(set: ReadonlySet<T>, member: T): Set<T> {
  const next = new Set(set);
  if (next.has(member)) next.delete(member);
  else next.add(member);
  return next;
}
