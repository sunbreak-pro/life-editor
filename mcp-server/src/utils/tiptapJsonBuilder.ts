export interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

export interface TipTapDoc {
  type: "doc";
  content: TipTapNode[];
}

export function doc(...content: TipTapNode[]): TipTapDoc {
  return { type: "doc", content };
}

export function heading(
  level: 1 | 2 | 3,
  text: string,
  fontSize?: string,
): TipTapNode {
  const attrs: Record<string, unknown> = { level };
  if (fontSize) attrs.fontSize = fontSize;
  return {
    type: "heading",
    attrs,
    content: text ? [{ type: "text", text }] : [],
  };
}

export function paragraph(text?: string): TipTapNode {
  if (!text) return { type: "paragraph" };
  return {
    type: "paragraph",
    content: [{ type: "text", text }],
  };
}

export function bulletList(...items: string[]): TipTapNode {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [paragraph(item)],
    })),
  };
}

export function orderedList(...items: string[]): TipTapNode {
  return {
    type: "orderedList",
    content: items.map((item) => ({
      type: "listItem",
      content: [paragraph(item)],
    })),
  };
}

export function taskList(
  ...items: Array<{ text: string; checked: boolean }>
): TipTapNode {
  return {
    type: "taskList",
    content: items.map((item) => ({
      type: "taskItem",
      attrs: { checked: item.checked },
      content: [paragraph(item.text)],
    })),
  };
}

export function toggleList(
  summary: string,
  ...content: TipTapNode[]
): TipTapNode {
  return {
    type: "toggleList",
    attrs: { open: true },
    content: [
      {
        type: "toggleSummary",
        content: summary ? [{ type: "text", text: summary }] : [],
      },
      {
        type: "toggleContent",
        content: content.length > 0 ? content : [paragraph()],
      },
    ],
  };
}

export function callout(
  content: TipTapNode[],
  opts?: { iconName?: string; color?: string },
): TipTapNode {
  return {
    type: "callout",
    attrs: {
      iconName: opts?.iconName ?? "Lightbulb",
      color: opts?.color ?? "default",
    },
    content: content.length > 0 ? content : [paragraph()],
  };
}

export function codeBlock(code: string, language?: string): TipTapNode {
  return {
    type: "codeBlock",
    attrs: language ? { language } : {},
    content: code ? [{ type: "text", text: code }] : [],
  };
}

export function blockquote(...content: TipTapNode[]): TipTapNode {
  return {
    type: "blockquote",
    content: content.length > 0 ? content : [paragraph()],
  };
}

export function horizontalRule(): TipTapNode {
  return { type: "horizontalRule" };
}

export function table(headers: string[], rows: string[][]): TipTapNode {
  const headerRow: TipTapNode = {
    type: "tableRow",
    content: headers.map((h) => ({
      type: "tableHeader",
      content: [paragraph(h)],
    })),
  };

  const dataRows: TipTapNode[] = rows.map((row) => ({
    type: "tableRow",
    content: row.map((cell) => ({
      type: "tableCell",
      content: [paragraph(cell)],
    })),
  }));

  return {
    type: "table",
    content: [headerRow, ...dataRows],
  };
}
