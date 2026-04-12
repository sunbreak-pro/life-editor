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

/** Container types whose children should get individual grip handles */
const CONTAINER_TYPES = new Set([
  "callout",
  "toggleContent",
  "bulletList",
  "orderedList",
  "taskList",
]);

/** Types that are the direct wrapper we want to target (depth target = their child) */
const WRAPPER_TYPES = new Set(["toggleList"]);

export interface ResolvedBlock {
  pos: number;
  size: number;
  depth: number;
}

/**
 * Try resolving a ProseMirror position from coords and walk up to find
 * the best draggable block.
 */
function resolveFromCoords(
  view: EditorView,
  left: number,
  top: number,
): ResolvedBlock | null {
  const posInfo = view.posAtCoords({ left, top });
  if (!posInfo) return null;

  try {
    const $pos = view.state.doc.resolve(posInfo.pos);

    for (let d = $pos.depth; d >= 1; d--) {
      const parentNode = $pos.node(d);
      const parentName = parentNode.type.name;

      if (CONTAINER_TYPES.has(parentName) && d + 1 <= $pos.depth) {
        const childPos = $pos.before(d + 1);
        const childNode = view.state.doc.nodeAt(childPos);
        if (childNode) {
          return { pos: childPos, size: childNode.nodeSize, depth: d + 1 };
        }
      }

      if (WRAPPER_TYPES.has(parentName)) {
        continue;
      }
    }

    if ($pos.depth >= 1) {
      const blockPos = $pos.before(1);
      const node = $pos.node(1);
      return { pos: blockPos, size: node.nodeSize, depth: 1 };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Resolve the most specific draggable block at a given position.
 * For containers (callout, toggle content, lists), returns the child block.
 * Falls back to top-level block.
 */
export function resolveTargetBlock(
  view: EditorView,
  clientX: number,
  clientY: number,
): ResolvedBlock | null {
  // First try: use actual mouse X — most accurate for nested content
  const result = resolveFromCoords(view, clientX, clientY);
  if (result && result.depth > 1) return result;

  // Second try: use center of editor — better for top-level detection
  const editorRect = view.dom.getBoundingClientRect();
  const centerResult = resolveFromCoords(view, editorRect.left + 20, clientY);
  if (centerResult) return centerResult;

  // Final fallback: top-level block resolution
  if (result) return result;
  const top = resolveTopLevelBlock(view, clientY);
  return top ? { ...top, depth: 1 } : null;
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

export interface DropTarget {
  pos: number;
  size: number;
  /** Dropping inside a container (callout or toggle content) */
  insideContainer: boolean;
  /** "callout" | "toggleList" */
  containerType?: string;
  containerPos?: number;
  containerSize?: number;
  /** True when toggle is closed — show highlight instead of indicator */
  closedToggle?: boolean;
}

/** Find nearest child block inside a container by Y position */
function findNearestChild(
  view: EditorView,
  parentPos: number,
  parentNode: {
    childCount: number;
    child: (i: number) => { nodeSize: number };
  },
  clientY: number,
): { pos: number; size: number } | null {
  let bestChild: { pos: number; size: number } | null = null;
  let bestDist = Infinity;
  let childPos = parentPos + 1; // skip open tag

  for (let i = 0; i < parentNode.childCount; i++) {
    const child = parentNode.child(i);
    const childDOM = getDOMForPos(view, childPos);
    if (childDOM) {
      const childRect = childDOM.getBoundingClientRect();
      const centerY = childRect.top + childRect.height / 2;
      const dist = Math.abs(clientY - centerY);
      if (dist < bestDist) {
        bestDist = dist;
        bestChild = { pos: childPos, size: child.nodeSize };
      }
    }
    childPos += child.nodeSize;
  }
  return bestChild;
}

/**
 * Resolve a drop target that may be inside a callout or toggle list.
 * For callouts: returns child block inside the callout content.
 * For toggle lists (open): returns child block inside toggleContent.
 * For toggle lists (closed): returns the toggle itself with closedToggle=true.
 */
export function resolveDropTarget(
  view: EditorView,
  clientX: number,
  clientY: number,
): DropTarget | null {
  const topBlock = resolveTopLevelBlock(view, clientY);
  if (!topBlock) return null;

  const node = view.state.doc.nodeAt(topBlock.pos);
  if (!node) {
    return { pos: topBlock.pos, size: topBlock.size, insideContainer: false };
  }

  const typeName = node.type.name;

  // --- Callout ---
  if (typeName === "callout") {
    const calloutDOM = getDOMForPos(view, topBlock.pos);
    if (!calloutDOM) {
      return { pos: topBlock.pos, size: topBlock.size, insideContainer: false };
    }

    const calloutRect = calloutDOM.getBoundingClientRect();
    const INSET = 12;
    if (
      clientX < calloutRect.left + INSET ||
      clientX > calloutRect.right - INSET ||
      clientY < calloutRect.top + INSET ||
      clientY > calloutRect.bottom - INSET
    ) {
      return { pos: topBlock.pos, size: topBlock.size, insideContainer: false };
    }

    const bestChild = findNearestChild(view, topBlock.pos, node, clientY);
    if (bestChild) {
      return {
        pos: bestChild.pos,
        size: bestChild.size,
        insideContainer: true,
        containerType: "callout",
        containerPos: topBlock.pos,
        containerSize: topBlock.size,
      };
    }
    return { pos: topBlock.pos, size: topBlock.size, insideContainer: false };
  }

  // --- Toggle List ---
  if (typeName === "toggleList") {
    const toggleDOM = getDOMForPos(view, topBlock.pos);
    if (!toggleDOM) {
      return { pos: topBlock.pos, size: topBlock.size, insideContainer: false };
    }

    const toggleRect = toggleDOM.getBoundingClientRect();
    const INSET = 8;
    const isInside =
      clientX >= toggleRect.left + INSET &&
      clientX <= toggleRect.right - INSET &&
      clientY >= toggleRect.top + INSET &&
      clientY <= toggleRect.bottom - INSET;

    if (!isInside) {
      return { pos: topBlock.pos, size: topBlock.size, insideContainer: false };
    }

    const isOpen = node.attrs.open !== false;

    if (!isOpen) {
      // Closed toggle: return the toggle itself, flagged as closed
      return {
        pos: topBlock.pos,
        size: topBlock.size,
        insideContainer: true,
        containerType: "toggleList",
        containerPos: topBlock.pos,
        containerSize: topBlock.size,
        closedToggle: true,
      };
    }

    // Open toggle: find toggleContent child and resolve inside it
    // toggleList structure: toggleSummary (index 0) + toggleContent (index 1)
    if (node.childCount >= 2) {
      const summary = node.child(0);
      const content = node.child(1);
      const contentPos = topBlock.pos + 1 + summary.nodeSize;

      // Check if cursor is in the content area
      const contentDOM = getDOMForPos(view, contentPos);
      if (contentDOM) {
        const contentRect = contentDOM.getBoundingClientRect();
        if (clientY >= contentRect.top) {
          const bestChild = findNearestChild(
            view,
            contentPos,
            content,
            clientY,
          );
          if (bestChild) {
            return {
              pos: bestChild.pos,
              size: bestChild.size,
              insideContainer: true,
              containerType: "toggleList",
              containerPos: topBlock.pos,
              containerSize: topBlock.size,
            };
          }
        }
      }
    }

    return { pos: topBlock.pos, size: topBlock.size, insideContainer: false };
  }

  return { pos: topBlock.pos, size: topBlock.size, insideContainer: false };
}
