import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Strike from "@tiptap/extension-strike";
import Code from "@tiptap/extension-code";
import Blockquote from "@tiptap/extension-blockquote";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { ResizableImage } from "../../extensions/ResizableImage";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import {
  ToggleList,
  ToggleSummary,
  ToggleContent,
} from "../../extensions/ToggleList";
import { Callout } from "../../extensions/Callout";
import { CustomHeading } from "../../extensions/CustomHeading";
import { CustomInputRules } from "../../extensions/InputRules";
import { WikiTag } from "../../extensions/WikiTag";
import { NoteLink } from "../../extensions/NoteLink";
import { PdfAttachment } from "../../extensions/PdfAttachment";
import { FileUploadPlaceholder } from "../../extensions/FileUploadPlaceholder";
import { DatabaseBlock } from "../../extensions/DatabaseBlock";
import { BlockBackground } from "../../extensions/BlockBackground";
import { BubbleToolbar } from "../Tasks/TaskDetail/BubbleToolbar";
import { BlockContextMenu } from "../Tasks/TaskDetail/BlockContextMenu";
import { WikiTagSuggestionMenu } from "../WikiTags/WikiTagSuggestionMenu";
import { NoteLinkSuggestionMenu } from "./NoteLinkSuggestionMenu";
import { useWikiTagSync } from "../../hooks/useWikiTagSync";
import { useNoteLinkSync } from "../../hooks/useNoteLinkSync";
import { useAttachments } from "../../hooks/useAttachments";
import { setStoredHeadingFontSize } from "../../utils/headingFontSize";
import { isValidUrl } from "../../utils/urlValidation";
import { resolveTopLevelBlock } from "../../utils/prosemirrorHelpers";
import { getDataService } from "../../services";
import { NodeSelection } from "@tiptap/pm/state";
import type { WikiTagEntityType } from "../../types/wikiTag";
import type { Node as PmNode } from "@tiptap/pm/model";
import { useIsTouchDevice } from "../../hooks/useIsTouchDevice";

interface ContextMenuState {
  x: number;
  y: number;
  blockPos: number;
  blockNode: PmNode;
}

// Disable markdown input rules so ** / * / ~~ / ` don't auto-convert
const BoldNoInputRules = Bold.extend({
  addInputRules() {
    return [];
  },
});
const ItalicNoInputRules = Italic.extend({
  addInputRules() {
    return [];
  },
});
const StrikeNoInputRules = Strike.extend({
  addInputRules() {
    return [];
  },
});
const CodeNoInputRules = Code.extend({
  addInputRules() {
    return [];
  },
});
// Disable blockquote's > input rule (replaced by CustomInputRules → ToggleList)
const BlockquoteNoInputRules = Blockquote.extend({
  addInputRules() {
    return [];
  },
});

interface RichTextEditorProps {
  taskId: string;
  initialContent?: string;
  onUpdate: (content: string) => void;
  entityType?: WikiTagEntityType;
  syncEntityId?: string;
  editable?: boolean;
}

const ATTACHMENT_SCHEME = "attachment://";

function collectAttachmentIds(json: Record<string, unknown>): string[] {
  const ids: string[] = [];
  function walk(node: Record<string, unknown>) {
    if (node.type === "image") {
      const src = (node.attrs as Record<string, unknown>)?.src as string;
      if (src?.startsWith(ATTACHMENT_SCHEME)) {
        ids.push(src.slice(ATTACHMENT_SCHEME.length));
      }
    }
    if (node.type === "pdfAttachment") {
      const aid = (node.attrs as Record<string, unknown>)
        ?.attachmentId as string;
      if (aid) ids.push(aid);
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child as Record<string, unknown>);
    }
  }
  walk(json);
  return ids;
}

function sanitizeContentForSave(
  json: Record<string, unknown>,
  blobUrlToId: Map<string, string>,
): Record<string, unknown> {
  function walk(node: Record<string, unknown>): Record<string, unknown> | null {
    // Strip ephemeral placeholder nodes
    if (node.type === "fileUploadPlaceholder") {
      return null;
    }
    if (node.type === "image") {
      const attrs = node.attrs as Record<string, unknown>;
      const src = attrs?.src as string;
      if (src && blobUrlToId.has(src)) {
        return {
          ...node,
          attrs: {
            ...attrs,
            src: `${ATTACHMENT_SCHEME}${blobUrlToId.get(src)}`,
          },
        };
      }
    }
    if (Array.isArray(node.content)) {
      return {
        ...node,
        content: (node.content as unknown[])
          .map((c) => walk(c as Record<string, unknown>))
          .filter(Boolean),
      };
    }
    return node;
  }
  return walk(json) ?? { type: "doc", content: [] };
}

export function RichTextEditor({
  taskId,
  initialContent,
  onUpdate,
  entityType = "task",
  syncEntityId,
  editable = true,
}: RichTextEditorProps) {
  const debounceRef = useRef<number | null>(null);
  const onUpdateRef = useRef(onUpdate);
  const latestContentRef = useRef<string | null>(null);
  const resolvingRef = useRef(false);
  const imageUploadRef = useRef<(file: File) => void>(() => {});
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const isTouch = useIsTouchDevice();
  const {
    resolveAttachmentUrls,
    uploadImage,
    uploadPdf,
    cleanup: cleanupBlobUrls,
    blobUrlsRef,
  } = useAttachments();

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  });

  // Flush pending debounce on unmount (note/task switch)
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (latestContentRef.current !== null) {
        onUpdateRef.current(latestContentRef.current);
        latestContentRef.current = null;
      }
    };
  }, []);

  // Flush pending debounce on window close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (latestContentRef.current !== null) {
        onUpdateRef.current(latestContentRef.current);
        latestContentRef.current = null;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: false,
          bold: false,
          italic: false,
          strike: false,
          code: false,
          blockquote: false,
          link: false,
          dropcursor: {
            color: "var(--color-accent)",
            width: 2,
          },
        }),
        CustomHeading.configure({ levels: [1, 2, 3] }),
        BoldNoInputRules,
        ItalicNoInputRules,
        StrikeNoInputRules,
        CodeNoInputRules,
        BlockquoteNoInputRules,
        Link.configure({ openOnClick: false }),
        TextStyle,
        Color,
        Placeholder.configure({
          includeChildren: true,
          placeholder: ({ node }) => {
            if (node.type.name === "heading") {
              const level = node.attrs.level as number;
              return `見出し ${level}`;
            }
            return "Type '/' for commands...";
          },
        }),
        Table.configure({ resizable: true }),
        TableRow,
        TableCell,
        TableHeader,
        ResizableImage,
        TaskList,
        TaskItem.configure({ nested: true }),
        ToggleList,
        ToggleSummary,
        ToggleContent,
        Callout,
        WikiTag,
        NoteLink,
        PdfAttachment,
        FileUploadPlaceholder,
        DatabaseBlock,
        BlockBackground,
        Highlight.configure({ multicolor: true }),
        CustomInputRules,
      ],
      editable,
      content: initialContent ? tryParseJSON(initialContent) : undefined,
      enableContentCheck: true,
      onContentError: ({ error }) => {
        console.warn("[RichTextEditor] TipTap content schema error", error, {
          taskId,
          entityType,
        });
      },
      onUpdate: ({ editor }) => {
        if (resolvingRef.current) return;
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        // Sanitize blob URLs back to attachment:// before saving
        const rawJson = editor.getJSON();
        const reverseMap = new Map<string, string>();
        for (const [id, url] of Object.entries(blobUrlsRef.current)) {
          reverseMap.set(url, id);
        }
        const sanitized = sanitizeContentForSave(
          rawJson as Record<string, unknown>,
          reverseMap,
        );
        const json = JSON.stringify(sanitized);
        latestContentRef.current = json;
        debounceRef.current = window.setTimeout(() => {
          onUpdateRef.current(json);
          latestContentRef.current = null;
        }, 800);
      },
      editorProps: {
        attributes: {
          class: "memo-editor outline-none min-h-[200px]",
        },
        handleClickOn(_view, _pos, node, _nodePos, _event, direct) {
          if (node.type.name === "databaseBlock" && direct) {
            return true;
          }
          return false;
        },
        handleDoubleClickOn(view, _pos, node, nodePos, _event, direct) {
          if (node.type.name === "databaseBlock" && direct) {
            const tr = view.state.tr.setSelection(
              NodeSelection.create(view.state.doc, nodePos),
            );
            view.dispatch(tr);
            return true;
          }
          return false;
        },
        handleClick(_view, _pos, event) {
          const target = event.target as HTMLElement;
          const linkEl = target.closest("a[href]");
          if (!linkEl) return false;
          const href = linkEl.getAttribute("href");
          if (!href) return false;
          const validated = isValidUrl(href);
          if (validated) {
            event.preventDefault();
            getDataService().openExternal(validated);
          }
          return true;
        },
        handlePaste(_view, event) {
          const items = event.clipboardData?.items;
          if (!items) return false;
          for (const item of Array.from(items)) {
            if (item.type.startsWith("image/")) {
              const file = item.getAsFile();
              if (file) {
                event.preventDefault();
                imageUploadRef.current(file);
                return true;
              }
            }
          }
          return false;
        },
        handleDrop(_view, event) {
          const files = event.dataTransfer?.files;
          if (!files?.length) return false;
          const imageFile = Array.from(files).find((f) =>
            f.type.startsWith("image/"),
          );
          if (imageFile) {
            event.preventDefault();
            imageUploadRef.current(imageFile);
            return true;
          }
          return false;
        },
        handleDOMEvents: {
          contextmenu(view, event) {
            const block = resolveTopLevelBlock(view, event.clientY);
            if (block) {
              event.preventDefault();
              const node = view.state.doc.nodeAt(block.pos);
              if (node) {
                const customEvent = new CustomEvent("draghandle:contextmenu", {
                  detail: {
                    x: event.clientX,
                    y: event.clientY,
                    pos: block.pos,
                  },
                  bubbles: true,
                });
                view.dom.dispatchEvent(customEvent);
              }
            }
            return true;
          },
        },
      },
    },
    [taskId],
  );

  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editor, editable]);

  // Upload image and insert into editor
  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!editor) return;
      const result = await uploadImage(file);
      if (result) {
        editor
          .chain()
          .focus()
          .setImage({ src: result.blobUrl, attachmentId: result.id } as never)
          .run();
      }
    },
    [editor, uploadImage],
  );

  const handlePdfUpload = useCallback(
    async (file: File) => {
      if (!editor) return;
      const result = await uploadPdf(file);
      if (result) {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "pdfAttachment",
            attrs: {
              attachmentId: result.id,
              filename: result.filename,
              size: result.size,
            },
          })
          .run();
      }
    },
    [editor, uploadPdf],
  );

  // Keep ref in sync for editorProps callbacks
  imageUploadRef.current = handleImageUpload;

  // Wire upload callbacks into extension storage
  useEffect(() => {
    if (!editor) return;
    const storage = editor.extensionStorage as {
      fileUploadPlaceholder?: {
        onImageUpload?: typeof handleImageUpload;
        onPdfUpload?: typeof handlePdfUpload;
      };
    };
    if (storage.fileUploadPlaceholder) {
      storage.fileUploadPlaceholder.onImageUpload = handleImageUpload;
      storage.fileUploadPlaceholder.onPdfUpload = handlePdfUpload;
    }
  }, [editor, handleImageUpload, handlePdfUpload]);

  // Resolve attachment:// URLs to blob URLs after editor mount
  useEffect(() => {
    if (!editor || !initialContent) return;
    const parsed = tryParseJSON(initialContent);
    if (typeof parsed === "string") return;
    const ids = collectAttachmentIds(parsed as Record<string, unknown>);
    if (ids.length === 0) return;

    let cancelled = false;
    (async () => {
      const urlMap = await resolveAttachmentUrls(ids);
      if (cancelled || !editor || editor.isDestroyed) return;

      resolvingRef.current = true;
      const { tr } = editor.state;
      let modified = false;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "image") {
          const src = node.attrs.src as string;
          if (src?.startsWith(ATTACHMENT_SCHEME)) {
            const id = src.slice(ATTACHMENT_SCHEME.length);
            const blobUrl = urlMap[id];
            if (blobUrl) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                src: blobUrl,
                attachmentId: id,
              });
              modified = true;
            }
          }
        }
      });
      if (modified) {
        tr.setMeta("addToHistory", false);
        editor.view.dispatch(tr);
      }
      resolvingRef.current = false;
    })();

    return () => {
      cancelled = true;
    };
  }, [editor, taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      cleanupBlobUrls();
    };
  }, [cleanupBlobUrls]);

  useWikiTagSync(editor, syncEntityId ?? taskId, entityType);

  const noteLinkSource = useMemo(() => {
    const id = syncEntityId ?? taskId;
    if (entityType === "note") {
      return { kind: "note" as const, noteId: id };
    }
    if (entityType === "daily") {
      return { kind: "daily" as const, dailyDate: id };
    }
    return null;
  }, [entityType, syncEntityId, taskId]);
  useNoteLinkSync(editor, noteLinkSource);

  // Monitor heading fontSize changes and persist to localStorage
  const handleHeadingFontSizeChange = useCallback(() => {
    if (!editor) return;
    const { $from } = editor.state.selection;
    const node = $from.parent;
    if (node.type.name === "heading") {
      const level = node.attrs.level as 1 | 2 | 3;
      const fontSize = node.attrs.fontSize as string | undefined;
      if (fontSize) {
        setStoredHeadingFontSize(level, fontSize);
      }
    }
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    editor.on("transaction", handleHeadingFontSizeChange);
    return () => {
      editor.off("transaction", handleHeadingFontSizeChange);
    };
  }, [editor, handleHeadingFontSizeChange]);

  // Listen for draghandle:contextmenu custom events
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    let dom: HTMLElement;
    try {
      dom = editor.view.dom;
    } catch {
      return;
    }
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        x: number;
        y: number;
        pos: number;
      };
      const node = editor.state.doc.nodeAt(detail.pos);
      if (node) {
        setContextMenu({
          x: detail.x,
          y: detail.y,
          blockPos: detail.pos,
          blockNode: node,
        });
      }
    };
    dom.addEventListener("draghandle:contextmenu", handler);
    return () => dom.removeEventListener("draghandle:contextmenu", handler);
  }, [editor]);

  return (
    <div className="relative mx-auto w-full max-w-full px-2 md:max-w-[760px] md:pl-10 md:pr-0">
      <EditorContent editor={editor} />
      {editor && <BubbleToolbar editor={editor} />}
      {editor && <NoteLinkSuggestionMenu editor={editor} />}
      {editor && <WikiTagSuggestionMenu editor={editor} />}
      {editor && !isTouch && contextMenu && (
        <BlockContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          editor={editor}
          blockPos={contextMenu.blockPos}
          blockNode={contextMenu.blockNode}
          onClose={() => {
            setContextMenu(null);
            editor.view.focus();
          }}
        />
      )}
    </div>
  );
}

function tryParseJSON(str: string): Record<string, unknown> | string {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}
