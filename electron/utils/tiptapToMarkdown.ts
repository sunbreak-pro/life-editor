import type { TipTapNode, TipTapDoc } from "./tiptapJsonBuilder";

/* Callout color → GitHub alert type reverse mapping */
const COLOR_TO_ALERT: Record<string, string> = {
  blue: "NOTE",
  green: "TIP",
  yellow: "WARNING",
  purple: "IMPORTANT",
  red: "CAUTION",
};

function renderMarks(node: TipTapNode): string {
  const text = node.text ?? "";
  if (!node.marks || node.marks.length === 0) return text;

  let result = text;
  for (const mark of node.marks) {
    switch (mark.type) {
      case "bold":
        result = `**${result}**`;
        break;
      case "italic":
        result = `*${result}*`;
        break;
      case "code":
        result = `\`${result}\``;
        break;
      case "strike":
        result = `~~${result}~~`;
        break;
      case "link": {
        const href = (mark.attrs?.href as string) ?? "";
        result = `[${result}](${href})`;
        break;
      }
      // highlight, textStyle, color — no standard markdown, output as plain text
    }
  }
  return result;
}

function renderInline(nodes: TipTapNode[] | undefined): string {
  if (!nodes) return "";
  return nodes
    .map((n) => (n.type === "text" ? renderMarks(n) : renderNode(n)))
    .join("");
}

function renderListItem(
  node: TipTapNode,
  prefix: string,
  depth: number,
): string {
  const indent = "  ".repeat(depth);
  const lines: string[] = [];
  const content = node.content ?? [];

  for (let i = 0; i < content.length; i++) {
    const child = content[i];
    if (i === 0 && child.type === "paragraph") {
      lines.push(`${indent}${prefix}${renderInline(child.content)}`);
    } else if (child.type === "bulletList") {
      lines.push(renderList(child, depth + 1));
    } else if (child.type === "orderedList") {
      lines.push(renderList(child, depth + 1));
    } else {
      lines.push(`${indent}${renderNode(child)}`);
    }
  }
  return lines.join("\n");
}

function renderList(node: TipTapNode, depth: number = 0): string {
  const items = node.content ?? [];
  const lines: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (node.type === "bulletList") {
      lines.push(renderListItem(item, "- ", depth));
    } else if (node.type === "orderedList") {
      lines.push(renderListItem(item, `${i + 1}. `, depth));
    }
  }
  return lines.join("\n");
}

function renderTableRow(cells: TipTapNode[]): string {
  const rendered = cells.map((cell) => {
    const content = cell.content ?? [];
    return content
      .map((c) =>
        c.type === "paragraph" ? renderInline(c.content) : renderNode(c),
      )
      .join(" ")
      .replace(/\|/g, "\\|");
  });
  return `| ${rendered.join(" | ")} |`;
}

function renderNode(node: TipTapNode): string {
  switch (node.type) {
    case "paragraph":
      return renderInline(node.content);

    case "heading": {
      const level = (node.attrs?.level as number) ?? 1;
      const hashes = "#".repeat(Math.min(level, 6));
      return `${hashes} ${renderInline(node.content)}`;
    }

    case "bulletList":
    case "orderedList":
      return renderList(node);

    case "taskList": {
      const items = node.content ?? [];
      return items
        .map((item) => {
          const checked = item.attrs?.checked ? "x" : " ";
          const text =
            item.content
              ?.map((c) =>
                c.type === "paragraph"
                  ? renderInline(c.content)
                  : renderNode(c),
              )
              .join(" ") ?? "";
          return `- [${checked}] ${text}`;
        })
        .join("\n");
    }

    case "codeBlock": {
      const lang = (node.attrs?.language as string) ?? "";
      const code = node.content?.map((c) => c.text ?? "").join("") ?? "";
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }

    case "blockquote": {
      const inner = node.content ?? [];
      return inner
        .map((c) => {
          const line =
            c.type === "paragraph" ? renderInline(c.content) : renderNode(c);
          return `> ${line}`;
        })
        .join("\n");
    }

    case "horizontalRule":
      return "---";

    case "toggleList": {
      const summaryNode = node.content?.find((c) => c.type === "toggleSummary");
      const contentNode = node.content?.find((c) => c.type === "toggleContent");
      const summary = renderInline(summaryNode?.content);
      const inner =
        contentNode?.content?.map((c) => renderNode(c)).join("\n\n") ?? "";
      return `<details>\n<summary>${summary}</summary>\n\n${inner}\n</details>`;
    }

    case "callout": {
      const color = (node.attrs?.color as string) ?? "default";
      const alertType = COLOR_TO_ALERT[color] ?? "NOTE";
      const bodyLines = (node.content ?? [])
        .map((c) => {
          const line =
            c.type === "paragraph" ? renderInline(c.content) : renderNode(c);
          return `> ${line}`;
        })
        .join("\n");
      return `> [!${alertType}]\n${bodyLines}`;
    }

    case "table": {
      const rows = node.content ?? [];
      if (rows.length === 0) return "";

      const headerRow = rows[0];
      const headerCells = headerRow.content ?? [];
      const headerLine = renderTableRow(headerCells);
      const separatorLine = `| ${headerCells.map(() => "---").join(" | ")} |`;
      const dataLines = rows
        .slice(1)
        .map((row) => renderTableRow(row.content ?? []));

      return [headerLine, separatorLine, ...dataLines].join("\n");
    }

    case "image":
    case "resizableImage": {
      const src = (node.attrs?.src as string) ?? "";
      const alt = (node.attrs?.alt as string) ?? "";
      if (!src || src.startsWith("attachment://"))
        return `<!-- image: ${alt || "attachment"} -->`;
      return `![${alt}](${src})`;
    }

    case "pdfAttachment": {
      const filename = (node.attrs?.filename as string) ?? "PDF";
      return `[PDF: ${filename}]`;
    }

    case "databaseBlock":
      return "[Database Block]";

    case "blockBackground":
      return (node.content ?? []).map((c) => renderNode(c)).join("\n\n");

    case "text":
      return renderMarks(node);

    default: {
      // Best-effort: render children if present, otherwise empty
      if (node.content && node.content.length > 0) {
        return node.content.map((c) => renderNode(c)).join("\n\n");
      }
      return "";
    }
  }
}

export function tiptapToMarkdown(doc: TipTapDoc): string {
  const blocks = doc.content ?? [];
  const rendered = blocks.map((block) => renderNode(block));

  // Join blocks with double newline, collapse triple+ newlines
  return rendered
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
