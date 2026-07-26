/*
 * Fair-share truncation for a mixed-role candidate list.
 *
 * A pool built by concatenating per-role fetches is ordered by ROLE, not by
 * relevance, so a plain `.slice(0, limit)` hands every slot to whichever role
 * was pushed first. The "[[" link autocomplete hit exactly that: notes are
 * appended before dailies and tasks, so a user with 8+ notes never saw a task
 * candidate — the pool contained them, the cap ate them (#370).
 *
 * Round-robin one item per role per pass instead, so every role present gets a
 * slot before any role gets a second one. Roles keep their first-seen order
 * (the caller's priority), and items keep their relative order within a role.
 * When only one role is present the result is identical to `.slice()`.
 */
export function balanceByRole<T extends { role: string }>(
  items: readonly T[],
  limit: number,
): T[] {
  if (limit <= 0) return [];
  if (items.length <= limit) return [...items];

  // Bucket by role, preserving both first-seen role order and item order.
  const byRole = new Map<string, T[]>();
  for (const item of items) {
    const bucket = byRole.get(item.role);
    if (bucket) bucket.push(item);
    else byRole.set(item.role, [item]);
  }

  const buckets = [...byRole.values()];
  const out: T[] = [];
  for (let round = 0; out.length < limit; round++) {
    let placed = false;
    for (const bucket of buckets) {
      const item = bucket[round];
      if (item === undefined) continue;
      out.push(item);
      placed = true;
      if (out.length === limit) return out;
    }
    // No bucket reached this depth — every item is already out (unreachable
    // while items.length > limit, but it keeps the loop provably finite).
    if (!placed) break;
  }
  return out;
}
