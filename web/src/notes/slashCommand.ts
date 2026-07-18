import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
} from "lucide-react";
import {
  SlashMenu,
  type SlashMenuHandle,
  type SlashMenuItem,
} from "./SlashMenu";

/*
 * Slash-command extension (web Notes/Daily editor). Types "/" to open a block
 * picker: headings 1–3 + bullet / ordered / checkbox (task) lists. Built on
 * TipTap's Suggestion util; the floating menu is a ReactRenderer positioned
 * against the caret rect (no tippy dependency). Labels are injected by the host
 * (i18n stays out of the shared editor); the transforms delete the typed
 * "/query" range first, then apply the block.
 */

export interface SlashMenuLabels {
  heading1: string;
  heading2: string;
  heading3: string;
  bulletList: string;
  orderedList: string;
  taskList: string;
  /** Shown when the query matches nothing. */
  empty: string;
}

function buildSlashItems(labels: SlashMenuLabels): SlashMenuItem[] {
  return [
    {
      id: "heading1",
      title: labels.heading1,
      Icon: Heading1,
      command: ({ editor, range }) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 1 })
          .run(),
    },
    {
      id: "heading2",
      title: labels.heading2,
      Icon: Heading2,
      command: ({ editor, range }) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 2 })
          .run(),
    },
    {
      id: "heading3",
      title: labels.heading3,
      Icon: Heading3,
      command: ({ editor, range }) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 3 })
          .run(),
    },
    {
      id: "bulletList",
      title: labels.bulletList,
      Icon: List,
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).toggleBulletList().run(),
    },
    {
      id: "orderedList",
      title: labels.orderedList,
      Icon: ListOrdered,
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
    },
    {
      id: "taskList",
      title: labels.taskList,
      Icon: ListChecks,
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).toggleTaskList().run(),
    },
  ];
}

type SlashRender = SuggestionOptions<SlashMenuItem>["render"];

function slashRender(emptyLabel: string): SlashRender {
  return () => {
    let renderer: ReactRenderer<SlashMenuHandle> | null = null;
    let popup: HTMLDivElement | null = null;

    const position = (rect: DOMRect | null | undefined) => {
      if (!popup || !rect) return;
      popup.style.left = `${rect.left + window.scrollX}px`;
      popup.style.top = `${rect.bottom + window.scrollY + 6}px`;
    };

    // Full teardown, safe to call more than once — subsequent onUpdate/onExit
    // become no-ops (both guard on the nulled refs). Used by Escape and onExit.
    const destroy = () => {
      popup?.remove();
      popup = null;
      renderer?.destroy();
      renderer = null;
    };

    return {
      onStart: (props) => {
        renderer = new ReactRenderer(SlashMenu, {
          props: { ...props, emptyLabel },
          editor: props.editor,
        });
        popup = document.createElement("div");
        popup.style.position = "absolute";
        popup.style.zIndex = "60";
        popup.appendChild(renderer.element);
        document.body.appendChild(popup);
        position(props.clientRect?.());
      },
      onUpdate: (props) => {
        if (!renderer) return;
        renderer.updateProps({ ...props, emptyLabel });
        position(props.clientRect?.());
      },
      onKeyDown: (props) => {
        if (props.event.key === "Escape") {
          destroy();
          return true;
        }
        return renderer?.ref?.onKeyDown(props.event) ?? false;
      },
      onExit: destroy,
    };
  };
}

/**
 * Build the slash-command extension with host-injected (translated) labels.
 * Returns null-safe config: pass to the editor's extension list.
 */
export function createSlashCommand(labels: SlashMenuLabels): Extension {
  return Extension.create({
    name: "slashCommand",
    addProseMirrorPlugins() {
      return [
        Suggestion<SlashMenuItem>({
          editor: this.editor,
          char: "/",
          startOfLine: false,
          command: ({ editor, range, props }) => {
            props.command({ editor, range });
          },
          items: ({ query }) => {
            const all = buildSlashItems(labels);
            const q = query.trim().toLowerCase();
            if (!q) return all;
            return all.filter(
              (item) =>
                item.title.toLowerCase().includes(q) ||
                item.id.toLowerCase().includes(q),
            );
          },
          render: slashRender(labels.empty),
        }),
      ];
    },
  });
}
