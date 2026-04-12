import { Extension } from "@tiptap/core";
import {
  Plugin,
  PluginKey,
  TextSelection,
  NodeSelection,
} from "@tiptap/pm/state";
import type { Slice } from "@tiptap/pm/model";
import {
  resolveTopLevelBlock,
  getDOMForPos,
  resolveDropTarget,
  resolveTargetBlock,
} from "../utils/prosemirrorHelpers";

const DRAG_HANDLE_KEY = new PluginKey("dragHandle");

const PLUS_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const GRIP_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg>`;

/** Minimum px mouse must move before drag activates (same as dnd-kit PointerSensor) */
const DRAG_ACTIVATION_PX = 5;

// ---- State ----

type DragPhase = "idle" | "pending" | "dragging";

const dragState = {
  phase: "idle" as DragPhase,
  activePos: null as number | null,
  activeDepth: 1,
  sourcePos: null as number | null,
  sourceEnd: null as number | null,
  sourceSlice: null as Slice | null,
  startX: 0,
  startY: 0,
  dropBefore: true,
  dropTargetPos: null as number | null,
  dropTargetSize: null as number | null,
  insideContainer: false,
  containerPos: null as number | null,
  containerSize: null as number | null,
  closedToggle: false,
};

function resetDragState(): void {
  dragState.phase = "idle";
  dragState.activePos = null;
  dragState.activeDepth = 1;
  dragState.sourcePos = null;
  dragState.sourceEnd = null;
  dragState.sourceSlice = null;
  dragState.startX = 0;
  dragState.startY = 0;
  dragState.dropBefore = true;
  dragState.dropTargetPos = null;
  dragState.dropTargetSize = null;
  dragState.insideContainer = false;
  dragState.containerPos = null;
  dragState.containerSize = null;
  dragState.closedToggle = false;
}

// ---- Extension ----

export const DragHandle = Extension.create({
  name: "dragHandle",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: DRAG_HANDLE_KEY,
        view(editorView) {
          const editorDOM = editorView.dom;
          const container = editorDOM.parentElement!;

          // ---- Create handle DOM ----
          const handle = document.createElement("div");
          handle.className = "drag-handle";
          handle.innerHTML = `
            <button class="drag-handle-btn drag-handle-plus" type="button">${PLUS_SVG}</button>
            <div class="drag-handle-btn drag-handle-grip">${GRIP_SVG}</div>
          `;
          const plusBtn = handle.querySelector(
            ".drag-handle-plus",
          ) as HTMLButtonElement;
          const gripEl = handle.querySelector(
            ".drag-handle-grip",
          ) as HTMLDivElement;
          container.appendChild(handle);

          // ---- Drop indicator ----
          const dropLine = document.createElement("div");
          dropLine.className = "drag-drop-indicator";
          container.appendChild(dropLine);

          // ---- Local UI state ----
          let hideTimer: ReturnType<typeof setTimeout> | null = null;

          function show(): void {
            if (hideTimer) {
              clearTimeout(hideTimer);
              hideTimer = null;
            }
            handle.classList.add("visible");
          }

          function hide(): void {
            handle.classList.remove("visible");
            dragState.activePos = null;
          }

          function scheduledHide(): void {
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(hide, 200);
          }

          const HANDLE_HEIGHT = 24;

          /** Compute effective first-line height for a block element */
          function getFirstLineHeight(el: HTMLElement): number {
            const styles = getComputedStyle(el);
            const lh = parseFloat(styles.lineHeight);
            if (!isNaN(lh)) return lh;
            // lineHeight is "normal" — approximate from fontSize
            return parseFloat(styles.fontSize) * 1.4;
          }

          /**
           * Get the top-level DOM element for a block.
           * nodeDOM may return an inner element for atom NodeViews,
           * so walk up to the direct child of the editor DOM.
           */
          function getTopBlockDOM(pos: number): HTMLElement | null {
            let dom = getDOMForPos(editorView, pos);
            if (!dom) return null;
            while (dom && dom.parentElement !== editorDOM) {
              dom = dom.parentElement as HTMLElement | null;
            }
            return dom;
          }

          /**
           * Get the DOM element for any block (nested or top-level).
           * For top-level blocks, walks up to editor DOM child.
           * For nested blocks, uses nodeDOM or domAtPos fallback.
           */
          function getBlockDOM(pos: number, depth: number): HTMLElement | null {
            if (depth <= 1) return getTopBlockDOM(pos);
            // Try nodeDOM first
            const dom = getDOMForPos(editorView, pos);
            if (dom) return dom;
            // Fallback: use domAtPos and walk up to find block-level element
            try {
              const { node, offset } = editorView.domAtPos(pos);
              let el = node instanceof HTMLElement ? node : node.parentElement;
              // Walk up to a block-level element (p, div, li, etc.)
              while (el && el !== editorDOM) {
                const display = getComputedStyle(el).display;
                if (
                  display === "block" ||
                  display === "list-item" ||
                  display === "flex"
                ) {
                  return el;
                }
                el = el.parentElement;
              }
            } catch {
              /* ignore */
            }
            return null;
          }

          function positionHandle(pos: number, depth: number = 1): void {
            const blockDOM = getBlockDOM(pos, depth);
            if (!blockDOM) {
              hide();
              return;
            }
            const containerRect = container.getBoundingClientRect();
            const blockRect = blockDOM.getBoundingClientRect();
            const lineHeight = getFirstLineHeight(blockDOM);
            const firstLineCenterY = blockRect.top + lineHeight / 2;
            handle.style.top = `${firstLineCenterY - containerRect.top - HANDLE_HEIGHT / 2}px`;
            // Indent handle for nested blocks
            const handleLeft = blockRect.left - containerRect.left - 40;
            handle.style.left =
              depth > 1 ? `${Math.max(0, handleLeft)}px` : "0px";
            show();
          }

          // ---- Find scrollable parent for wide-area hover detection ----
          function findScrollParent(el: HTMLElement): HTMLElement {
            let node = el.parentElement;
            while (node) {
              const overflow = getComputedStyle(node).overflowY;
              if (overflow === "auto" || overflow === "scroll") return node;
              node = node.parentElement;
            }
            return document.documentElement;
          }
          const scrollParent = findScrollParent(container);

          // ---- Mouse tracking (on scrollParent for wide-area detection) ----
          function onMouseMove(e: MouseEvent): void {
            if (dragState.phase !== "idle") return;
            if (document.body.style.cursor.includes("resize")) return;

            if (handle.contains(e.target as Node)) {
              show();
              return;
            }

            // Only respond when mouse is to the LEFT of the editor's right edge
            const editorRect = editorDOM.getBoundingClientRect();
            if (e.clientX > editorRect.right) {
              scheduledHide();
              return;
            }

            const block = resolveTargetBlock(editorView, e.clientX, e.clientY);
            if (!block) {
              scheduledHide();
              return;
            }

            if (block.pos === dragState.activePos) {
              show();
              return;
            }

            dragState.activePos = block.pos;
            dragState.activeDepth = block.depth;
            positionHandle(block.pos, block.depth);
          }

          function onScrollParentLeave(): void {
            if (dragState.phase === "idle") {
              scheduledHide();
            }
          }

          handle.addEventListener("mouseenter", show);
          handle.addEventListener("mouseleave", scheduledHide);

          // ---- Plus button ----
          plusBtn.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (dragState.activePos === null) return;

            try {
              const { state } = editorView;
              const node = state.doc.nodeAt(dragState.activePos);
              if (!node) return;

              const blockEnd = dragState.activePos + node.nodeSize;
              const tr = state.tr;
              const schema = state.schema;
              const newPara = schema.nodes.paragraph.create(
                null,
                schema.text("/"),
              );
              tr.insert(blockEnd, newPara);
              tr.setSelection(TextSelection.create(tr.doc, blockEnd + 2));
              editorView.dispatch(tr);
              editorView.focus();
            } catch (err) {
              console.error("[DragHandle] +button failed:", err);
            }
            hide();
          });

          // ---- Drag overlay ----
          let overlay: HTMLElement | null = null;

          function showOverlay(
            sourceDOM: HTMLElement,
            clientX: number,
            clientY: number,
          ): void {
            overlay = sourceDOM.cloneNode(true) as HTMLElement;
            overlay.className = "drag-block-overlay";
            // Match source width
            const rect = sourceDOM.getBoundingClientRect();
            overlay.style.width = `${rect.width}px`;
            overlay.style.left = `${clientX}px`;
            overlay.style.top = `${clientY}px`;
            document.body.appendChild(overlay);
          }

          function moveOverlay(clientX: number, clientY: number): void {
            if (overlay) {
              overlay.style.left = `${clientX}px`;
              overlay.style.top = `${clientY}px`;
            }
          }

          function removeOverlay(): void {
            if (overlay) {
              overlay.remove();
              overlay = null;
            }
          }

          // ---- Pointer-based drag (replaces native HTML5 drag) ----

          function onGripPointerDown(e: PointerEvent): void {
            if (e.button !== 0) return;
            if (dragState.activePos === null) return;

            const { state } = editorView;
            const node = state.doc.nodeAt(dragState.activePos);
            if (!node) return;

            e.preventDefault();
            gripEl.setPointerCapture(e.pointerId);

            const sourcePos = dragState.activePos;
            const sourceEnd = sourcePos + node.nodeSize;

            dragState.sourceSlice = state.doc.slice(sourcePos, sourceEnd);
            dragState.sourcePos = sourcePos;
            dragState.sourceEnd = sourceEnd;
            dragState.phase = "pending";
            dragState.startX = e.clientX;
            dragState.startY = e.clientY;
          }

          function onGripPointerMove(e: PointerEvent): void {
            if (dragState.phase === "idle") return;

            // Activation threshold
            if (dragState.phase === "pending") {
              const dx = e.clientX - dragState.startX;
              const dy = e.clientY - dragState.startY;
              if (
                Math.abs(dx) < DRAG_ACTIVATION_PX &&
                Math.abs(dy) < DRAG_ACTIVATION_PX
              ) {
                return;
              }
              // Activate drag
              dragState.phase = "dragging";
              const sourceDOM =
                dragState.sourcePos !== null
                  ? getBlockDOM(dragState.sourcePos, dragState.activeDepth)
                  : null;
              if (sourceDOM) {
                sourceDOM.classList.add("drag-source");
                showOverlay(sourceDOM, e.clientX, e.clientY);
              }
              editorDOM.classList.add("is-dragging");
              handle.classList.remove("visible");
            }

            // Move overlay to follow cursor
            moveOverlay(e.clientX, e.clientY);

            // Position drop indicator
            const target = resolveDropTarget(editorView, e.clientX, e.clientY);
            if (!target) {
              dropLine.classList.remove("visible");
              return;
            }

            // Clear previous closed-toggle highlight
            editorDOM
              .querySelectorAll(".drag-over-container")
              .forEach((el) => el.classList.remove("drag-over-container"));

            // Don't show indicator on source block (top-level check)
            if (
              dragState.sourcePos !== null &&
              dragState.sourceEnd !== null &&
              !target.insideContainer &&
              target.pos >= dragState.sourcePos &&
              target.pos < dragState.sourceEnd
            ) {
              dropLine.classList.remove("visible");
              return;
            }

            // Closed toggle: highlight the toggle instead of showing line
            if (target.closedToggle) {
              dropLine.classList.remove("visible");
              const toggleDOM = getTopBlockDOM(target.pos);
              if (toggleDOM) {
                toggleDOM.classList.add("drag-over-container");
              }
              dragState.dropBefore = true;
              dragState.dropTargetPos = target.pos;
              dragState.dropTargetSize = target.size;
              dragState.insideContainer = true;
              dragState.containerPos = target.containerPos ?? null;
              dragState.containerSize = target.containerSize ?? null;
              dragState.closedToggle = true;
              return;
            }

            // For container drops, get the child block DOM; for top-level, get top block DOM
            const targetDOM = target.insideContainer
              ? getDOMForPos(editorView, target.pos)
              : getTopBlockDOM(target.pos);
            if (!targetDOM) {
              dropLine.classList.remove("visible");
              return;
            }

            const containerRect = container.getBoundingClientRect();
            const blockRect = targetDOM.getBoundingClientRect();
            const midY = blockRect.top + blockRect.height / 2;
            const insertBefore = e.clientY < midY;

            // Show indicator at block edge
            const lineY = Math.round(
              insertBefore ? blockRect.top : blockRect.bottom,
            );

            dragState.dropBefore = insertBefore;
            dragState.dropTargetPos = target.pos;
            dragState.dropTargetSize = target.size;
            dragState.insideContainer = target.insideContainer;
            dragState.containerPos = target.containerPos ?? null;
            dragState.containerSize = target.containerSize ?? null;
            dragState.closedToggle = false;

            dropLine.style.top = `${lineY - containerRect.top}px`;
            if (target.insideContainer) {
              dropLine.classList.add("inside-container");
            } else {
              dropLine.classList.remove("inside-container");
            }
            dropLine.classList.add("visible");
          }

          /** Guaranteed cleanup — always resets all drag state and visuals */
          function cleanupDrag(): void {
            removeOverlay();
            editorDOM.classList.remove("is-dragging");
            editorDOM
              .querySelectorAll(".drag-source")
              .forEach((el) => el.classList.remove("drag-source"));
            dropLine.classList.remove("visible");
            dropLine.classList.remove("inside-container");
            editorDOM
              .querySelectorAll(".drag-over-container")
              .forEach((el) => el.classList.remove("drag-over-container"));
            resetDragState();
            hide();
          }

          function onGripPointerUp(e: PointerEvent): void {
            if (dragState.phase === "idle") return;

            try {
              gripEl.releasePointerCapture(e.pointerId);
            } catch {
              /* may already be released */
            }

            // If still pending (didn't move enough), select block and open context menu
            if (dragState.phase === "pending") {
              const pos = dragState.sourcePos;
              cleanupDrag();
              if (pos !== null) {
                // Set NodeSelection on the block (visual blue background)
                try {
                  const tr = editorView.state.tr.setSelection(
                    NodeSelection.create(editorView.state.doc, pos),
                  );
                  editorView.dispatch(tr);
                } catch {
                  /* some nodes may not support NodeSelection */
                }

                const event = new CustomEvent("draghandle:contextmenu", {
                  detail: { x: e.clientX, y: e.clientY, pos },
                  bubbles: true,
                });
                editorDOM.dispatchEvent(event);
              }
              return;
            }

            try {
              if (
                dragState.phase === "dragging" &&
                dragState.sourceSlice &&
                dragState.sourcePos !== null &&
                dragState.sourceEnd !== null &&
                dragState.dropTargetPos !== null &&
                dragState.dropTargetSize !== null
              ) {
                let dropPos: number;

                if (dragState.closedToggle && dragState.containerPos !== null) {
                  // Closed toggle: insert at end of toggleContent
                  const toggleNode = editorView.state.doc.nodeAt(
                    dragState.containerPos,
                  );
                  if (toggleNode && toggleNode.childCount >= 2) {
                    const summary = toggleNode.child(0);
                    const content = toggleNode.child(1);
                    // End of toggleContent (before its closing tag)
                    dropPos =
                      dragState.containerPos +
                      1 +
                      summary.nodeSize +
                      content.nodeSize -
                      1;
                  } else {
                    dropPos = dragState.dropBefore
                      ? dragState.dropTargetPos
                      : dragState.dropTargetPos + dragState.dropTargetSize;
                  }
                } else {
                  dropPos = dragState.dropBefore
                    ? dragState.dropTargetPos
                    : dragState.dropTargetPos + dragState.dropTargetSize;
                }

                // Determine effective source range for self-drop check
                const isSelfDrop =
                  !dragState.insideContainer &&
                  dropPos >= dragState.sourcePos &&
                  dropPos <= dragState.sourceEnd;

                if (!isSelfDrop) {
                  const { state } = editorView;
                  const tr = state.tr;
                  const slice = dragState.sourceSlice;

                  if (dropPos > dragState.sourcePos) {
                    tr.delete(dragState.sourcePos, dragState.sourceEnd);
                    const mapped = tr.mapping.map(dropPos);
                    tr.insert(mapped, slice.content);
                    try {
                      tr.setSelection(
                        TextSelection.near(tr.doc.resolve(mapped + 1)),
                      );
                    } catch {
                      /* best-effort */
                    }
                  } else {
                    tr.insert(dropPos, slice.content);
                    const mappedStart = tr.mapping.map(dragState.sourcePos);
                    const mappedEnd = tr.mapping.map(dragState.sourceEnd);
                    tr.delete(mappedStart, mappedEnd);
                    try {
                      tr.setSelection(
                        TextSelection.near(tr.doc.resolve(dropPos + 1)),
                      );
                    } catch {
                      /* best-effort */
                    }
                  }

                  editorView.dispatch(tr);
                }
              }
            } catch (err) {
              console.error("[DragHandle] drop failed:", err);
            }

            cleanupDrag();
            editorView.focus();
          }

          function onGripPointerCancel(): void {
            cleanupDrag();
          }

          function onLostPointerCapture(): void {
            // Pointer capture lost unexpectedly (e.g., element removed, scroll)
            if (dragState.phase !== "idle") {
              cleanupDrag();
            }
          }

          gripEl.addEventListener("pointerdown", onGripPointerDown);
          gripEl.addEventListener("pointermove", onGripPointerMove);
          gripEl.addEventListener("pointerup", onGripPointerUp);
          gripEl.addEventListener("pointercancel", onGripPointerCancel);
          gripEl.addEventListener("lostpointercapture", onLostPointerCapture);

          // ---- Attach listeners ----
          scrollParent.addEventListener("mousemove", onMouseMove);
          scrollParent.addEventListener("mouseleave", onScrollParentLeave);

          return {
            update() {
              if (dragState.activePos !== null && dragState.phase === "idle") {
                const blockDOM = getBlockDOM(
                  dragState.activePos,
                  dragState.activeDepth,
                );
                if (blockDOM && container.contains(blockDOM)) {
                  const containerRect = container.getBoundingClientRect();
                  const blockRect = blockDOM.getBoundingClientRect();
                  const lineHeight = getFirstLineHeight(blockDOM);
                  const firstLineCenterY = blockRect.top + lineHeight / 2;
                  handle.style.top = `${firstLineCenterY - containerRect.top - HANDLE_HEIGHT / 2}px`;
                } else {
                  hide();
                }
              }
            },
            destroy() {
              if (hideTimer) clearTimeout(hideTimer);
              gripEl.removeEventListener("pointerdown", onGripPointerDown);
              gripEl.removeEventListener("pointermove", onGripPointerMove);
              gripEl.removeEventListener("pointerup", onGripPointerUp);
              gripEl.removeEventListener("pointercancel", onGripPointerCancel);
              gripEl.removeEventListener(
                "lostpointercapture",
                onLostPointerCapture,
              );
              scrollParent.removeEventListener("mousemove", onMouseMove);
              scrollParent.removeEventListener(
                "mouseleave",
                onScrollParentLeave,
              );
              removeOverlay();
              handle.remove();
              dropLine.remove();
              resetDragState();
            },
          };
        },
      }),
    ];
  },
});
