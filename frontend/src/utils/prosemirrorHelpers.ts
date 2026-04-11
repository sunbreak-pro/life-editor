import type { EditorView } from "@tiptap/pm/view";
import type { Transaction } from "@tiptap/pm/state";

/**
 * Safely build and dispatch a ProseMirror transaction.
 * Swallows errors for best-effort operations (e.g. invalid positions).
 */
export function safeDispatch(
  view: EditorView,
  buildTr: (tr: Transaction) => Transaction,
): boolean {
  try {
    const tr = buildTr(view.state.tr);
    view.dispatch(tr);
    return true;
  } catch {
    return false;
  }
}

/** Resolve a document position to the top-level block it belongs to. */
function resolveToBlock(
  view: EditorView,
  pos: number,
): { pos: number; size: number } | null {
  const resolved = view.state.doc.resolve(pos);
  if (resolved.depth >= 1) {
    const blockPos = resolved.before(1);
    return { pos: blockPos, size: resolved.node(1).nodeSize };
  }
  // Depth 0: gap between top-level nodes (common with atom/NodeView blocks)
  if (resolved.nodeAfter) {
    return { pos, size: resolved.nodeAfter.nodeSize };
  }
  if (resolved.nodeBefore) {
    return {
      pos: pos - resolved.nodeBefore.nodeSize,
      size: resolved.nodeBefore.nodeSize,
    };
  }
  return null;
}

export function resolveTopLevelBlock(
  view: EditorView,
  clientY: number,
): { pos: number; size: number } | null {
  const editorRect = view.dom.getBoundingClientRect();
  const coords = { left: editorRect.left + 20, top: clientY };
  const posInfo = view.posAtCoords(coords);
  if (posInfo) {
    try {
      const result = resolveToBlock(view, posInfo.pos);
      if (result) return result;
    } catch {
      /* fall through */
    }
  }

  // DOM fallback — find nearest block by Y distance
  const children = view.dom.children;
  let bestChild: HTMLElement | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as HTMLElement;
    const rect = child.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    const dist = Math.abs(clientY - centerY);
    if (dist < bestDist) {
      bestDist = dist;
      bestChild = child;
    }
  }
  if (bestChild) {
    try {
      const pmPos = view.posAtDOM(bestChild, 0);
      const result = resolveToBlock(view, pmPos);
      if (result) return result;
    } catch {
      /* skip */
    }
  }

  if (view.state.doc.childCount > 0) {
    return { pos: 0, size: view.state.doc.child(0).nodeSize };
  }
  return null;
}

export function getDOMForPos(
  view: EditorView,
  pos: number,
): HTMLElement | null {
  try {
    const dom = view.nodeDOM(pos);
    return dom instanceof HTMLElement ? dom : null;
  } catch {
    return null;
  }
}
