import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { Slice } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";

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
  sourcePos: null as number | null,
  sourceEnd: null as number | null,
  sourceSlice: null as Slice | null,
  startX: 0,
  startY: 0,
};

function resetDragState(): void {
  dragState.phase = "idle";
  dragState.activePos = null;
  dragState.sourcePos = null;
  dragState.sourceEnd = null;
  dragState.sourceSlice = null;
  dragState.startX = 0;
  dragState.startY = 0;
}

// ---- Helpers ----

function resolveTopLevelBlock(
  view: EditorView,
  clientY: number,
): { pos: number; size: number } | null {
  const editorRect = view.dom.getBoundingClientRect();
  const coords = { left: editorRect.left + 20, top: clientY };
  const posInfo = view.posAtCoords(coords);
  if (posInfo) {
    try {
      const resolved = view.state.doc.resolve(posInfo.pos);
      if (resolved.depth >= 1) {
        const pos = resolved.before(1);
        return { pos, size: resolved.node(1).nodeSize };
      }
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
      const resolved = view.state.doc.resolve(pmPos);
      if (resolved.depth >= 1) {
        return { pos: resolved.before(1), size: resolved.node(1).nodeSize };
      }
    } catch {
      /* skip */
    }
  }

  if (view.state.doc.childCount > 0) {
    return { pos: 0, size: view.state.doc.child(0).nodeSize };
  }
  return null;
}

function getDOMForPos(view: EditorView, pos: number): HTMLElement | null {
  try {
    const dom = view.nodeDOM(pos);
    return dom instanceof HTMLElement ? dom : null;
  } catch {
    return null;
  }
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

          function positionHandle(pos: number): void {
            const blockDOM = getDOMForPos(editorView, pos);
            if (!blockDOM) {
              hide();
              return;
            }
            const containerRect = container.getBoundingClientRect();
            const blockRect = blockDOM.getBoundingClientRect();
            const lineHeight = getFirstLineHeight(blockDOM);
            const firstLineCenterY = blockRect.top + lineHeight / 2;
            handle.style.top = `${firstLineCenterY - containerRect.top - HANDLE_HEIGHT / 2}px`;
            handle.style.left = "0px";
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

            const block = resolveTopLevelBlock(editorView, e.clientY);
            if (!block) {
              scheduledHide();
              return;
            }

            if (block.pos === dragState.activePos) {
              show();
              return;
            }

            dragState.activePos = block.pos;
            positionHandle(block.pos);
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
                  ? getDOMForPos(editorView, dragState.sourcePos)
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
            const block = resolveTopLevelBlock(editorView, e.clientY);
            if (!block) {
              dropLine.classList.remove("visible");
              return;
            }

            // Don't show indicator on source block
            if (
              dragState.sourcePos !== null &&
              dragState.sourceEnd !== null &&
              block.pos >= dragState.sourcePos &&
              block.pos < dragState.sourceEnd
            ) {
              dropLine.classList.remove("visible");
              return;
            }

            const blockDOM = getDOMForPos(editorView, block.pos);
            if (!blockDOM) {
              dropLine.classList.remove("visible");
              return;
            }

            const containerRect = container.getBoundingClientRect();
            const blockRect = blockDOM.getBoundingClientRect();
            const midY = blockRect.top + blockRect.height / 2;
            const lineY = e.clientY < midY ? blockRect.top : blockRect.bottom;

            dropLine.style.top = `${lineY - containerRect.top}px`;
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

            // If still pending (didn't move enough), just cancel
            if (dragState.phase === "pending") {
              cleanupDrag();
              return;
            }

            try {
              if (
                dragState.phase === "dragging" &&
                dragState.sourceSlice &&
                dragState.sourcePos !== null &&
                dragState.sourceEnd !== null
              ) {
                // Find drop target
                const dropBlock = resolveTopLevelBlock(editorView, e.clientY);
                if (dropBlock) {
                  const dropDOM = getDOMForPos(editorView, dropBlock.pos);
                  if (dropDOM) {
                    const dropRect = dropDOM.getBoundingClientRect();
                    const midY = dropRect.top + dropRect.height / 2;
                    const dropAfter = e.clientY > midY;
                    const dropPos = dropAfter
                      ? dropBlock.pos + dropBlock.size
                      : dropBlock.pos;

                    // Only move if not dropping on self
                    if (
                      dropPos < dragState.sourcePos ||
                      dropPos > dragState.sourceEnd
                    ) {
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
                const blockDOM = getDOMForPos(editorView, dragState.activePos);
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
