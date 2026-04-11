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
  sourcePos: null as number | null,
  sourceEnd: null as number | null,
  sourceSlice: null as Slice | null,
  startX: 0,
  startY: 0,
  dropBefore: true,
  dropTargetPos: null as number | null,
  dropTargetSize: null as number | null,
};

function resetDragState(): void {
  dragState.phase = "idle";
  dragState.activePos = null;
  dragState.sourcePos = null;
  dragState.sourceEnd = null;
  dragState.sourceSlice = null;
  dragState.startX = 0;
  dragState.startY = 0;
  dragState.dropBefore = true;
  dragState.dropTargetPos = null;
  dragState.dropTargetSize = null;
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

          function positionHandle(pos: number): void {
            const blockDOM = getTopBlockDOM(pos);
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
                  ? getTopBlockDOM(dragState.sourcePos)
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

            const blockDOM = getTopBlockDOM(block.pos);
            if (!blockDOM) {
              dropLine.classList.remove("visible");
              return;
            }

            const containerRect = container.getBoundingClientRect();
            const blockRect = blockDOM.getBoundingClientRect();
            const midY = blockRect.top + blockRect.height / 2;
            const insertBefore = e.clientY < midY;

            // Show indicator at block edge
            const lineY = Math.round(
              insertBefore ? blockRect.top : blockRect.bottom,
            );

            dragState.dropBefore = insertBefore;
            dragState.dropTargetPos = block.pos;
            dragState.dropTargetSize = block.size;

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
                const dropPos = dragState.dropBefore
                  ? dragState.dropTargetPos
                  : dragState.dropTargetPos + dragState.dropTargetSize;

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
                const blockDOM = getTopBlockDOM(dragState.activePos);
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
