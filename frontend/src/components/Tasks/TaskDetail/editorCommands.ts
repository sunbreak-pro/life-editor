import type { Editor } from "@tiptap/react";
import type { LucideIcon } from "lucide-react";
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code2,
  Lightbulb,
  ChevronRight,
  Minus,
  Table2,
  ImageIcon,
} from "lucide-react";
import {
  getStoredHeadingFontSize,
  setStoredHeadingFontSize,
} from "../../../utils/headingFontSize";

export interface SubAction {
  label: string;
  action: (editor: Editor) => void;
}

export interface PanelCommand {
  title: string;
  icon: LucideIcon;
  description: string;
  group: string;
  action: (editor: Editor) => void;
  check?: (editor: Editor) => boolean;
  subActions?: SubAction[];
}

export function headingSubActions(level: 1 | 2 | 3): SubAction[] {
  const presets = ["24px", "32px", "48px", "64px"];
  return [
    ...presets.map((size) => ({
      label: size,
      action: (ed: Editor) => {
        setStoredHeadingFontSize(level, size);
        ed.chain()
          .focus()
          .setHeading({ level })
          .updateAttributes("heading", { fontSize: size })
          .run();
      },
    })),
    {
      label: "Custom...",
      action: () => {
        // Handled in component via customFontSizeInput state
      },
    },
  ];
}

function isInsideCallout(editor: Editor): boolean {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === "callout") return true;
  }
  return false;
}

function isInsideToggleList(editor: Editor): boolean {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const name = $from.node(d).type.name;
    if (name === "toggleList" || name === "toggleSummary") return true;
  }
  return false;
}

function unwrapCallout(editor: Editor): void {
  const { state } = editor;
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === "callout") {
      const calloutNode = $from.node(d);
      const calloutPos = $from.before(d);
      const calloutEnd = $from.after(d);
      const { tr } = state;
      const children: import("@tiptap/pm/model").Node[] = [];
      calloutNode.forEach((child) => children.push(child));
      tr.replaceWith(
        calloutPos,
        calloutEnd,
        children.length > 0
          ? children
          : [state.schema.nodes.paragraph.create()],
      );
      editor.view.dispatch(tr);
      return;
    }
  }
}

function unwrapToggleList(editor: Editor): void {
  const { state } = editor;
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === "toggleList") {
      const toggleNode = $from.node(d);
      const togglePos = $from.before(d);
      const toggleEnd = $from.after(d);
      const { tr } = state;
      let textContent = "";
      toggleNode.forEach((child) => {
        if (child.type.name === "toggleSummary") {
          textContent = child.textContent;
        }
      });
      tr.replaceWith(
        togglePos,
        toggleEnd,
        state.schema.nodes.paragraph.create(
          null,
          textContent ? [state.schema.text(textContent)] : undefined,
        ),
      );
      editor.view.dispatch(tr);
      return;
    }
  }
}

export const GROUP_ORDER = ["Basic Blocks", "Lists", "Advanced"] as const;

function applyHeadingWithStoredSize(editor: Editor, level: 1 | 2 | 3): void {
  const chain = editor.chain().focus().setHeading({ level });
  const stored = getStoredHeadingFontSize(level);
  if (stored) {
    chain.updateAttributes("heading", { fontSize: stored });
  }
  chain.run();
}

export const PANEL_COMMANDS: PanelCommand[] = [
  // Basic Blocks
  {
    title: "Paragraph",
    icon: Type,
    description: "Plain text block",
    group: "Basic Blocks",
    check: (editor) =>
      editor.isActive("paragraph") &&
      !editor.isActive("blockquote") &&
      !isInsideCallout(editor) &&
      !isInsideToggleList(editor),
    action: (editor) => {
      if (isInsideCallout(editor)) {
        unwrapCallout(editor);
        return;
      }
      if (isInsideToggleList(editor)) {
        unwrapToggleList(editor);
        return;
      }
      editor.chain().focus().setParagraph().run();
    },
  },
  {
    title: "Heading 1",
    icon: Heading1,
    description: "Large section heading",
    group: "Basic Blocks",
    check: (editor) => editor.isActive("heading", { level: 1 }),
    action: (editor) => applyHeadingWithStoredSize(editor, 1),
    subActions: headingSubActions(1),
  },
  {
    title: "Heading 2",
    icon: Heading2,
    description: "Medium section heading",
    group: "Basic Blocks",
    check: (editor) => editor.isActive("heading", { level: 2 }),
    action: (editor) => applyHeadingWithStoredSize(editor, 2),
    subActions: headingSubActions(2),
  },
  {
    title: "Heading 3",
    icon: Heading3,
    description: "Small section heading",
    group: "Basic Blocks",
    check: (editor) => editor.isActive("heading", { level: 3 }),
    action: (editor) => applyHeadingWithStoredSize(editor, 3),
    subActions: headingSubActions(3),
  },
  {
    title: "Blockquote",
    icon: Quote,
    description: "Capture a quote",
    group: "Basic Blocks",
    check: (editor) => editor.isActive("blockquote"),
    action: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    title: "Code Block",
    icon: Code2,
    description: "Code with syntax highlighting",
    group: "Basic Blocks",
    check: (editor) => editor.isActive("codeBlock"),
    action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    title: "Horizontal Rule",
    icon: Minus,
    description: "Visual divider",
    group: "Basic Blocks",
    action: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },

  // Lists
  {
    title: "Bullet List",
    icon: List,
    description: "Unordered list",
    group: "Lists",
    check: (editor) => editor.isActive("bulletList"),
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    title: "Ordered List",
    icon: ListOrdered,
    description: "Numbered list",
    group: "Lists",
    check: (editor) => editor.isActive("orderedList"),
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    title: "Task List",
    icon: CheckSquare,
    description: "List with checkboxes",
    group: "Lists",
    check: (editor) => editor.isActive("taskList"),
    action: (editor) => editor.chain().focus().toggleTaskList().run(),
  },

  // Advanced
  {
    title: "Callout",
    icon: Lightbulb,
    description: "Highlighted information block",
    group: "Advanced",
    check: (editor) => isInsideCallout(editor),
    action: (editor) => {
      const { state } = editor;
      const { $from } = state.selection;
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === "callout") return;
      }
      const blockNode = $from.parent;
      const pos = $from.before($from.depth);
      const end = $from.after($from.depth);
      const textContent = blockNode.textContent;
      const { tr } = state;
      tr.replaceWith(
        pos,
        end,
        state.schema.nodes.callout.create(
          { iconName: "Lightbulb", color: "default" },
          [
            state.schema.nodes.paragraph.create(
              null,
              textContent ? [state.schema.text(textContent)] : undefined,
            ),
          ],
        ),
      );
      editor.view.dispatch(tr);
    },
  },
  {
    title: "Toggle List",
    icon: ChevronRight,
    description: "Collapsible content block",
    group: "Advanced",
    check: (editor) => isInsideToggleList(editor),
    action: (editor) => {
      const { state } = editor;
      const { $from } = state.selection;
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === "toggleList") return;
      }
      const blockNode = $from.parent;
      const pos = $from.before($from.depth);
      const end = $from.after($from.depth);
      const textContent = blockNode.textContent;
      const { tr } = state;
      tr.replaceWith(
        pos,
        end,
        state.schema.nodes.toggleList.create({ open: true }, [
          state.schema.nodes.toggleSummary.create(
            null,
            textContent ? [state.schema.text(textContent)] : undefined,
          ),
          state.schema.nodes.toggleContent.create(null, [
            state.schema.nodes.paragraph.create(),
          ]),
        ]),
      );
      editor.view.dispatch(tr);
    },
  },
  {
    title: "Table",
    icon: Table2,
    description: "Table with rows and columns",
    group: "Advanced",
    action: (editor) => {
      editor
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
  {
    title: "Image",
    icon: ImageIcon,
    description: "Embed an image from URL",
    group: "Advanced",
    action: () => {
      // Handled via IMAGE_COMMAND_ID in CommandPanel
    },
  },
];

export function getCurrentBlockLabel(editor: Editor): string {
  for (const cmd of PANEL_COMMANDS) {
    if (cmd.check?.(editor)) return cmd.title;
  }
  return "Paragraph";
}
