import type { TipTapNode, TipTapDoc } from "./tiptapJsonBuilder.js";

interface Mark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface TextNode {
  type: "text";
  text: string;
  marks?: Mark[];
}

function parseInlineMarks(text: string): TipTapNode[] {
  const nodes: TipTapNode[] = [];
  // Order matters: code first (no nesting), then strikethrough, bold, italic
  const inlineRegex = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\~\~[^~]+\~\~)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRegex.exec(text)) !== null) {
    // Add plain text before this match
    if (match.index > lastIndex) {
      nodes.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }

    const full = match[0];
    if (match[1]) {
      // inline code: `code`
      const inner = full.slice(1, -1);
      const node: TextNode = {
        type: "text",
        text: inner,
        marks: [{ type: "code" }],
      };
      nodes.push(node);
    } else if (match[2]) {
      // bold: **text**
      const inner = full.slice(2, -2);
      const node: TextNode = {
        type: "text",
        text: inner,
        marks: [{ type: "bold" }],
      };
      nodes.push(node);
    } else if (match[3]) {
      // italic: *text*
      const inner = full.slice(1, -1);
      const node: TextNode = {
        type: "text",
        text: inner,
        marks: [{ type: "italic" }],
      };
      nodes.push(node);
    } else if (match[4]) {
      // strikethrough: ~~text~~
      const inner = full.slice(2, -2);
      const node: TextNode = {
        type: "text",
        text: inner,
        marks: [{ type: "strike" }],
      };
      nodes.push(node);
    }

    lastIndex = match.index + full.length;
  }

  // Remaining plain text
  if (lastIndex < text.length) {
    nodes.push({ type: "text", text: text.slice(lastIndex) });
  }

  return nodes;
}

function paragraphWithInline(text: string): TipTapNode {
  if (!text) return { type: "paragraph" };
  const content = parseInlineMarks(text);
  return { type: "paragraph", content };
}

function collectListItems(
  lines: string[],
  startIndex: number,
  prefix: RegExp,
): { items: string[]; nextIndex: number } {
  const items: string[] = [];
  let i = startIndex;
  while (i < lines.length) {
    const m = lines[i].match(prefix);
    if (!m) break;
    items.push(lines[i].replace(prefix, ""));
    i++;
  }
  return { items, nextIndex: i };
}

export function markdownToTiptap(text: string): TipTapDoc {
  const lines = text.split("\n");
  const content: TipTapNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    const codeBlockMatch = line.match(/^```(\w*)$/);
    if (codeBlockMatch) {
      const language = codeBlockMatch[1] || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].match(/^```$/)) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const attrs: Record<string, unknown> = {};
      if (language) attrs.language = language;
      content.push({
        type: "codeBlock",
        attrs,
        content: codeLines.length
          ? [{ type: "text", text: codeLines.join("\n") }]
          : [],
      });
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line)) {
      content.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3;
      const headingContent = parseInlineMarks(headingMatch[2]);
      content.push({
        type: "heading",
        attrs: { level },
        content: headingContent,
      });
      i++;
      continue;
    }

    // Task list: - [ ] or - [x]
    const taskMatch = line.match(/^- \[([ xX])\] /);
    if (taskMatch) {
      const taskItems: TipTapNode[] = [];
      while (i < lines.length) {
        const tm = lines[i].match(/^- \[([ xX])\] (.*)$/);
        if (!tm) break;
        taskItems.push({
          type: "taskItem",
          attrs: { checked: tm[1] !== " " },
          content: [paragraphWithInline(tm[2])],
        });
        i++;
      }
      content.push({ type: "taskList", content: taskItems });
      continue;
    }

    // Unordered list: - item
    if (/^- /.test(line)) {
      const { items, nextIndex } = collectListItems(lines, i, /^- /);
      content.push({
        type: "bulletList",
        content: items.map((item) => ({
          type: "listItem",
          content: [paragraphWithInline(item)],
        })),
      });
      i = nextIndex;
      continue;
    }

    // Ordered list: 1. item
    if (/^\d+\. /.test(line)) {
      const { items, nextIndex } = collectListItems(lines, i, /^\d+\.\s/);
      content.push({
        type: "orderedList",
        content: items.map((item) => ({
          type: "listItem",
          content: [paragraphWithInline(item)],
        })),
      });
      i = nextIndex;
      continue;
    }

    // Blockquote: > text
    const bqMatch = line.match(/^>\s?(.*)$/);
    if (bqMatch) {
      const bqLines: string[] = [];
      while (i < lines.length) {
        const bm = lines[i].match(/^>\s?(.*)$/);
        if (!bm) break;
        bqLines.push(bm[1]);
        i++;
      }
      content.push({
        type: "blockquote",
        content: bqLines.map((l) => paragraphWithInline(l)),
      });
      continue;
    }

    // Plain paragraph (including empty lines)
    content.push(paragraphWithInline(line));
    i++;
  }

  // Ensure at least one node
  if (content.length === 0) {
    content.push({ type: "paragraph" });
  }

  return { type: "doc", content };
}
