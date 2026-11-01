/*
 * A day's merge after a send (#2336). The outbox sender runs below the screens,
 * so this is how the Daily list, the open editor and the notice learn that the
 * server's body for a date is now the merged one. A plain store: the sender
 * publishes, and nothing is kept beyond the page.
 */
export interface DailyMerge {
  /** Grows with each publish in this page, so a screen can tell what it saw. */
  seq: number;
  date: string;
  body: string;
  updatedAt: string;
  /** The entry left the box. A notice waits for this, so one merge is one notice. */
  settled: boolean;
}

let lastSeq = 0;
const latestByDate = new Map<string, DailyMerge>();
const listeners = new Set<(merge: DailyMerge) => void>();

export function publishDailyMerge(merge: Omit<DailyMerge, "seq">): void {
  const published = { ...merge, seq: ++lastSeq };
  latestByDate.set(merge.date, published);
  for (const listener of listeners) listener(published);
}

export function subscribeDailyMerges(
  listener: (merge: DailyMerge) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function currentDailyMergeSeq(): number {
  return lastSeq;
}

/** The merge of `date` published after `seq`, for an editor that saw up to it. */
export function dailyMergeSince(date: string, seq: number): DailyMerge | null {
  const merge = latestByDate.get(date);
  return merge !== undefined && merge.seq > seq ? merge : null;
}
