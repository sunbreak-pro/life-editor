/*
 * blockMerge — a three-way merge of two TipTap documents, block by block
 * (#2057 D-3).
 *
 * When the open note was changed somewhere else while the user had unsaved
 * typing, the screen offers "keep mine / take theirs / keep both". The first
 * two need no merge. "Both" does, and so does the difference view that lets
 * the user choose: both are built here, from the same three inputs —
 *
 *   base    the body this editor last had in common with the server
 *   mine    what the editor holds now
 *   theirs  what the server holds now
 *
 * The unit is a TOP-LEVEL block of the document (a paragraph, a heading, a
 * whole list, a table): small enough that two people editing different
 * paragraphs never collide, and coarse enough that a block is always valid
 * on its own, so the merged document needs no repair. A block both sides
 * changed is not resolved — the merged document carries both versions, mine
 * first (D-3: "同じブロックを両方が変えたら、両方を並べる").
 *
 * The alignment is the classic diff3: line up base with each side by their
 * longest common subsequence, walk the blocks that all three agree on, and
 * classify whatever lies between two such points. Blocks are compared by a
 * key-order-independent serialisation, because the server's `jsonb` hands
 * keys back in its own order (see jsonDocEquals).
 *
 * Pure and DOM-free on purpose: the Notes editor is the first user, and the
 * Daily / Template / Todo bodies that share its editor are meant to follow
 * (#2057 NOTE-SYNC-6).
 */

/** One top-level block as stored: a TipTap JSON node. */
export type DocBlock = Record<string, unknown>;

/**
 * A stretch of the documents. `same` is a run all three agree on. The others
 * are a stretch where at least one side differs from base:
 *  - `mine`     only this editor changed it (theirs equals base)
 *  - `theirs`   only the other place changed it (mine equals base)
 *  - `agree`    both changed it the same way
 *  - `conflict` both changed it, differently
 */
export type MergeHunk =
  | { kind: "same"; blocks: DocBlock[] }
  | {
      kind: "mine" | "theirs" | "agree" | "conflict";
      base: DocBlock[];
      mine: DocBlock[];
      theirs: DocBlock[];
    };

export interface BlockMergeResult {
  /** The "keep both" document, serialised the way the editor stores it. */
  merged: string;
  hunks: MergeHunk[];
  /** True when at least one hunk is a `conflict`. */
  hasConflict: boolean;
}

const EMPTY_DOC_CONTENT: DocBlock[] = [{ type: "paragraph" }];

/** The top-level blocks of a stored body. "" (never written) has none. */
export function docBlocks(content: string): DocBlock[] {
  if (content === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    // A legacy plain-text body: one paragraph holding the text.
    return [{ type: "paragraph", content: [{ type: "text", text: content }] }];
  }
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    Array.isArray((parsed as { content?: unknown }).content)
  ) {
    return (parsed as { content: unknown[] }).content.filter(
      (b): b is DocBlock => typeof b === "object" && b !== null,
    );
  }
  return [];
}

/** Serialise blocks back into a document body. */
export function blocksToDoc(blocks: DocBlock[]): string {
  return JSON.stringify({
    type: "doc",
    content: blocks.length > 0 ? blocks : EMPTY_DOC_CONTENT,
  });
}

/** A key-order-independent serialisation: equal blocks, equal keys. */
export function blockKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(blockKey).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((k) => record[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${blockKey(record[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * Do two stored bodies hold the same document? Blank bodies count as equal
 * whatever their spelling — "" (never written) and a doc of empty paragraphs
 * are the same note to the person reading it, and calling them different
 * would raise a conflict over nothing.
 *
 * ONLY a wholly blank body gets that allowance. An empty paragraph inside a
 * body with text is content like any other block: the converter behind MCP
 * `update_note` adds and removes them, and treating them as noise would read
 * such a write as "nothing changed" and let the next save erase it.
 */
export function sameDocContent(a: string, b: string): boolean {
  if (a === b) return true;
  const ka = docBlocks(a);
  const kb = docBlocks(b);
  if (ka.every(isBlankBlock) && kb.every(isBlankBlock)) return true;
  if (ka.length !== kb.length) return false;
  return ka.every((blk, i) => blockKey(blk) === blockKey(kb[i]));
}

function isBlankBlock(block: DocBlock): boolean {
  if (block.type !== "paragraph") return false;
  const content = block.content;
  return !Array.isArray(content) || content.length === 0;
}

/** For each index of `a`, the index of `b` it is matched to (LCS). */
function lcsMatches(a: string[], b: string[]): Map<number, number> {
  const n = a.length;
  const m = b.length;
  // lengths[i][j] = LCS length of a[i..] and b[j..]
  const lengths: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lengths[i][j] =
        a[i] === b[j]
          ? lengths[i + 1][j + 1] + 1
          : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }
  const matches = new Map<number, number>();
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      matches.set(i, j);
      i++;
      j++;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return matches;
}

function sameKeys(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((k, i) => k === b[i]);
}

/** Three-way merge of stored bodies. See the file header. */
export function mergeDocBlocks(
  base: string,
  mine: string,
  theirs: string,
): BlockMergeResult {
  const o = docBlocks(base);
  const a = docBlocks(mine);
  const b = docBlocks(theirs);
  const ok = o.map(blockKey);
  const ak = a.map(blockKey);
  const bk = b.map(blockKey);
  const ma = lcsMatches(ok, ak);
  const mb = lcsMatches(ok, bk);

  const hunks: MergeHunk[] = [];
  const merged: DocBlock[] = [];
  let io = 0;
  let ia = 0;
  let ib = 0;

  const classify = (
    oKeys: string[],
    aKeys: string[],
    bKeys: string[],
    hunkBase: DocBlock[],
    hunkMine: DocBlock[],
    hunkTheirs: DocBlock[],
  ) => {
    if (sameKeys(aKeys, oKeys) && sameKeys(bKeys, oKeys)) {
      hunks.push({ kind: "same", blocks: hunkBase });
      merged.push(...hunkBase);
      return;
    }
    let kind: "mine" | "theirs" | "agree" | "conflict";
    if (sameKeys(aKeys, oKeys)) {
      kind = "theirs";
      merged.push(...hunkTheirs);
    } else if (sameKeys(bKeys, oKeys)) {
      kind = "mine";
      merged.push(...hunkMine);
    } else if (sameKeys(aKeys, bKeys)) {
      kind = "agree";
      merged.push(...hunkMine);
    } else {
      kind = "conflict";
      // Mine first, then whatever of theirs mine does not already carry, so
      // a block both sides inserted identically is not doubled.
      const mineKeys = new Set(aKeys);
      merged.push(
        ...hunkMine,
        ...hunkTheirs.filter((_, i) => !mineKeys.has(bKeys[i])),
      );
    }
    hunks.push({ kind, base: hunkBase, mine: hunkMine, theirs: hunkTheirs });
  };

  const emitUnstable = (oEnd: number, aEnd: number, bEnd: number) => {
    const oKeys = ok.slice(io, oEnd);
    const aKeys = ak.slice(ia, aEnd);
    const bKeys = bk.slice(ib, bEnd);
    const hunkBase = o.slice(io, oEnd);
    const hunkMine = a.slice(ia, aEnd);
    const hunkTheirs = b.slice(ib, bEnd);
    if (hunkBase.length + hunkMine.length + hunkTheirs.length === 0) return;
    /*
     * Same number of blocks on all three sides = blocks edited IN PLACE (no
     * insertions or deletions). Pair them by position, so two people editing
     * different paragraphs of a short note — where no unchanged block is left
     * to anchor the alignment — still merge cleanly instead of colliding.
     */
    if (
      hunkBase.length > 1 &&
      hunkBase.length === hunkMine.length &&
      hunkBase.length === hunkTheirs.length
    ) {
      for (let i = 0; i < hunkBase.length; i++) {
        classify(
          [oKeys[i]],
          [aKeys[i]],
          [bKeys[i]],
          [hunkBase[i]],
          [hunkMine[i]],
          [hunkTheirs[i]],
        );
      }
      return;
    }
    classify(oKeys, aKeys, bKeys, hunkBase, hunkMine, hunkTheirs);
  };

  while (io < o.length || ia < a.length || ib < b.length) {
    // A run of blocks all three agree on, each in step with the others.
    let k = 0;
    while (
      io + k < o.length &&
      ma.get(io + k) === ia + k &&
      mb.get(io + k) === ib + k
    ) {
      k++;
    }
    if (k > 0) {
      const blocks = o.slice(io, io + k);
      hunks.push({ kind: "same", blocks });
      merged.push(...blocks);
      io += k;
      ia += k;
      ib += k;
      continue;
    }
    // The next base block both sides still have — everything before it is
    // one unstable stretch.
    let next = io;
    while (next < o.length && !(ma.has(next) && mb.has(next))) next++;
    if (next >= o.length) {
      emitUnstable(o.length, a.length, b.length);
      io = o.length;
      ia = a.length;
      ib = b.length;
      break;
    }
    const aNext = ma.get(next) as number;
    const bNext = mb.get(next) as number;
    emitUnstable(next, aNext, bNext);
    io = next;
    ia = aNext;
    ib = bNext;
  }

  return {
    merged: blocksToDoc(merged),
    hunks,
    hasConflict: hunks.some((h) => h.kind === "conflict"),
  };
}

/**
 * The readable text of one block, for the difference view. Checklist items
 * keep their tick, so a box that was ticked on one side and not the other is
 * visible as a difference; nodes with no text at all are reported as "".
 */
export function blockText(block: DocBlock): string {
  const lines: string[] = [];
  const walk = (node: unknown, prefix: string) => {
    if (typeof node !== "object" || node === null) return;
    const n = node as {
      type?: string;
      text?: string;
      attrs?: Record<string, unknown>;
      content?: unknown[];
    };
    if (n.type === "taskItem") {
      const box = n.attrs?.checked === true ? "[x] " : "[ ] ";
      lines.push(`${prefix}${box}${inlineText(n.content)}`.trimEnd());
      for (const child of n.content ?? []) {
        if (isListNode(child)) walk(child, `${prefix}  `);
      }
      return;
    }
    if (n.type === "listItem") {
      lines.push(`${prefix}- ${inlineText(n.content)}`.trimEnd());
      for (const child of n.content ?? []) {
        if (isListNode(child)) walk(child, `${prefix}  `);
      }
      return;
    }
    if (isListNode(n) || n.type === "doc" || n.type === "blockquote") {
      for (const child of n.content ?? []) walk(child, prefix);
      return;
    }
    const text = inlineText(n.content ?? [n]);
    if (text !== "") lines.push(`${prefix}${text}`);
  };
  walk(block, "");
  return lines.join("\n");
}

function isListNode(node: unknown): boolean {
  const type = (node as { type?: string } | null)?.type;
  return type === "bulletList" || type === "orderedList" || type === "taskList";
}

/** Text of the inline content directly under a node (nested lists excluded). */
function inlineText(content: unknown[] | undefined): string {
  if (!content) return "";
  let out = "";
  const walk = (node: unknown) => {
    if (typeof node !== "object" || node === null) return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (isListNode(n)) return;
    if (typeof n.text === "string") out += n.text;
    for (const child of n.content ?? []) walk(child);
    if (n.type === "paragraph" || n.type === "heading") out += " ";
  };
  for (const node of content) walk(node);
  return out.replace(/\s+/g, " ").trim();
}
