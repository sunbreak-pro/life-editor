import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { X, Plus, Globe, AppWindow, Pencil, Trash2, Link2 } from "lucide-react";
import type { SidebarLink } from "../../types/sidebarLink";
import {
  LUCIDE_ICON_REGISTRY,
  parseLucideIconName,
} from "./lucideIconRegistry";
import { SidebarLinkAddDialog } from "./SidebarLinkAddDialog";
import { useSidebarLinksContext } from "../../hooks/useSidebarLinksContext";

interface SidebarLinksListDialogProps {
  anchorRect: DOMRect | null;
  onClose: () => void;
}

const POPOVER_WIDTH = 280;
const POPOVER_MAX_HEIGHT = 420;
const ANCHOR_GAP = 8;
const VIEWPORT_PADDING = 8;
const ARROW_SIZE = 10;

export function SidebarLinksListDialog({
  anchorRect,
  onClose,
}: SidebarLinksListDialogProps) {
  const { t } = useTranslation();
  const { links, openLink, createLink, updateLink, deleteLink } =
    useSidebarLinksContext();
  const [editorState, setEditorState] = useState<
    { mode: "closed" } | { mode: "add" } | { mode: "edit"; link: SidebarLink }
  >({ mode: "closed" });

  const containerRef = useRef<HTMLDivElement>(null);
  const [popoverHeight, setPopoverHeight] = useState(0);

  useLayoutEffect(() => {
    if (containerRef.current) {
      setPopoverHeight(containerRef.current.offsetHeight);
    }
  }, [links.length]);

  useEffect(() => {
    if (editorState.mode !== "closed") return;
    const onMouseDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [editorState.mode, onClose]);

  const left = anchorRect
    ? anchorRect.right + ANCHOR_GAP
    : window.innerWidth / 2 - POPOVER_WIDTH / 2;

  const desiredTop = anchorRect
    ? anchorRect.top +
      anchorRect.height / 2 -
      Math.min(popoverHeight || POPOVER_MAX_HEIGHT, POPOVER_MAX_HEIGHT) / 3
    : window.innerHeight / 2 - POPOVER_MAX_HEIGHT / 2;

  const maxTop =
    window.innerHeight -
    Math.min(popoverHeight || POPOVER_MAX_HEIGHT, POPOVER_MAX_HEIGHT) -
    VIEWPORT_PADDING;
  const top = Math.max(VIEWPORT_PADDING, Math.min(desiredTop, maxTop));

  const arrowTop = anchorRect
    ? Math.max(
        12,
        Math.min(
          anchorRect.top + anchorRect.height / 2 - top - ARROW_SIZE / 2,
          (popoverHeight || POPOVER_MAX_HEIGHT) - 12 - ARROW_SIZE,
        ),
      )
    : null;

  return createPortal(
    <>
      <div
        ref={containerRef}
        role="dialog"
        aria-label={t("sidebarLinks.sectionTitle", "Links")}
        className="fixed z-50 bg-notion-bg border border-notion-border rounded-lg shadow-xl"
        style={{ top, left, width: POPOVER_WIDTH }}
      >
        {arrowTop !== null && (
          <div
            className="absolute bg-notion-bg border-l border-b border-notion-border"
            style={{
              top: arrowTop,
              left: -ARROW_SIZE / 2,
              width: ARROW_SIZE,
              height: ARROW_SIZE,
              transform: "rotate(45deg)",
            }}
          />
        )}

        <div className="relative flex items-center justify-between px-3 py-2 border-b border-notion-border">
          <div className="flex items-center gap-1.5 text-xs font-medium text-notion-text">
            <Link2 size={12} className="text-notion-text-secondary" />
            {t("sidebarLinks.sectionTitle", "Links")}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-notion-hover text-notion-text-secondary"
            aria-label={t("common.close", "Close")}
          >
            <X size={12} />
          </button>
        </div>

        <div
          className="px-1.5 py-1.5 overflow-y-auto"
          style={{ maxHeight: POPOVER_MAX_HEIGHT - 90 }}
        >
          {links.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-notion-text-secondary italic">
              {t("sidebarLinks.empty", "No links yet")}
            </div>
          ) : (
            <ul className="space-y-0.5">
              {links.map((link) => {
                const lucideName = parseLucideIconName(link.emoji);
                const LucideIcon = lucideName
                  ? LUCIDE_ICON_REGISTRY[lucideName]
                  : null;
                const FallbackIcon = link.kind === "app" ? AppWindow : Globe;
                return (
                  <li
                    key={link.id}
                    className="group flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-notion-hover"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        openLink(link).catch(() => {
                          /* errors logged in useSidebarLinks */
                        });
                        onClose();
                      }}
                      className="flex-1 min-w-0 flex items-center gap-2 text-left"
                      title={link.target}
                    >
                      <span
                        className="shrink-0 inline-flex items-center justify-center text-notion-text-secondary"
                        style={{ width: 16, height: 16 }}
                      >
                        {LucideIcon ? (
                          <LucideIcon size={16} />
                        ) : link.emoji ? (
                          <span
                            className="leading-none"
                            style={{ fontSize: 14 }}
                          >
                            {link.emoji}
                          </span>
                        ) : (
                          <FallbackIcon size={16} />
                        )}
                      </span>
                      <span className="truncate text-xs text-notion-text">
                        {link.name}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorState({ mode: "edit", link })}
                      aria-label={t("common.edit", "Edit")}
                      className="p-1 rounded text-notion-text-secondary opacity-0 group-hover:opacity-100 hover:bg-notion-bg hover:text-notion-text transition-opacity"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        deleteLink(link.id);
                      }}
                      aria-label={t("common.delete", "Delete")}
                      className="p-1 rounded text-notion-text-secondary opacity-0 group-hover:opacity-100 hover:bg-notion-bg hover:text-red-500 transition-opacity"
                    >
                      <Trash2 size={11} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-end px-3 py-2 border-t border-notion-border">
          <button
            type="button"
            onClick={() => setEditorState({ mode: "add" })}
            className="px-2.5 py-1 text-[11px] rounded-md bg-notion-accent text-white hover:opacity-90 inline-flex items-center gap-1"
          >
            <Plus size={11} /> {t("sidebarLinks.add", "Add link")}
          </button>
        </div>
      </div>

      {editorState.mode !== "closed" && (
        <SidebarLinkAddDialog
          initial={editorState.mode === "edit" ? editorState.link : null}
          onClose={() => setEditorState({ mode: "closed" })}
          onSubmit={async (input) => {
            if (editorState.mode === "edit") {
              await updateLink(editorState.link.id, input);
            } else {
              await createLink(input);
            }
          }}
        />
      )}
    </>,
    document.body,
  );
}
