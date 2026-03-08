import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ToolParam {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

interface McpTool {
  name: string;
  description: string;
  params: ToolParam[];
}

const MCP_TOOLS: McpTool[] = [
  {
    name: "list_tasks",
    description:
      "List tasks. Optionally filter by status, date_range, or folder_id.",
    params: [
      {
        name: "status",
        type: "string (todo | in_progress | done)",
        description: "Filter by task status",
        required: false,
      },
      {
        name: "date_range",
        type: "object { start, end }",
        description: "Filter by scheduled date range (ISO 8601)",
        required: false,
      },
      {
        name: "folder_id",
        type: "string",
        description: "Filter by parent folder ID",
        required: false,
      },
    ],
  },
  {
    name: "get_task",
    description: "Get a single task by ID.",
    params: [
      { name: "id", type: "string", description: "Task ID", required: true },
    ],
  },
  {
    name: "create_task",
    description: "Create a new task.",
    params: [
      {
        name: "title",
        type: "string",
        description: "Task title",
        required: true,
      },
      {
        name: "parent_id",
        type: "string",
        description: "Parent folder ID",
        required: false,
      },
      {
        name: "scheduled_at",
        type: "string",
        description: "Scheduled start (ISO 8601)",
        required: false,
      },
      {
        name: "scheduled_end_at",
        type: "string",
        description: "Scheduled end (ISO 8601)",
        required: false,
      },
      {
        name: "is_all_day",
        type: "boolean",
        description: "All-day event",
        required: false,
      },
    ],
  },
  {
    name: "update_task",
    description: "Update an existing task. Only provide fields to change.",
    params: [
      { name: "id", type: "string", description: "Task ID", required: true },
      {
        name: "title",
        type: "string",
        description: "New title",
        required: false,
      },
      {
        name: "status",
        type: "string (todo | in_progress | done)",
        description: "New status",
        required: false,
      },
      {
        name: "content",
        type: "string",
        description: "New content (plain text → TipTap JSON)",
        required: false,
      },
    ],
  },
  {
    name: "delete_task",
    description: "Soft-delete a task (moves to trash).",
    params: [
      { name: "id", type: "string", description: "Task ID", required: true },
    ],
  },
  {
    name: "get_memo",
    description: "Get the daily memo for a specific date.",
    params: [
      {
        name: "date",
        type: "string",
        description: "Date in YYYY-MM-DD format",
        required: true,
      },
    ],
  },
  {
    name: "upsert_memo",
    description: "Create or update a daily memo.",
    params: [
      {
        name: "date",
        type: "string",
        description: "Date in YYYY-MM-DD format",
        required: true,
      },
      {
        name: "content",
        type: "string",
        description: "Memo content (plain text)",
        required: true,
      },
    ],
  },
  {
    name: "list_notes",
    description: "List all notes, optionally filtered by a search query.",
    params: [
      {
        name: "query",
        type: "string",
        description: "Search query (matches title and content)",
        required: false,
      },
    ],
  },
  {
    name: "create_note",
    description: "Create a new note.",
    params: [
      {
        name: "title",
        type: "string",
        description: "Note title",
        required: true,
      },
      {
        name: "content",
        type: "string",
        description: "Note content (plain text → TipTap JSON)",
        required: false,
      },
    ],
  },
  {
    name: "update_note",
    description: "Update an existing note. Only provide fields to change.",
    params: [
      { name: "id", type: "string", description: "Note ID", required: true },
      {
        name: "title",
        type: "string",
        description: "New title",
        required: false,
      },
      {
        name: "content",
        type: "string",
        description: "New content (plain text → TipTap JSON)",
        required: false,
      },
    ],
  },
  {
    name: "list_schedule",
    description: "List schedule items and scheduled tasks for a specific date.",
    params: [
      {
        name: "date",
        type: "string",
        description: "Date in YYYY-MM-DD format",
        required: true,
      },
    ],
  },
  {
    name: "search_all",
    description: "Search across tasks, memos, and notes.",
    params: [
      {
        name: "query",
        type: "string",
        description: "Search keyword",
        required: true,
      },
      {
        name: "domains",
        type: "array (tasks | memos | notes)",
        description: "Domains to search (default: all)",
        required: false,
      },
      {
        name: "limit",
        type: "number",
        description: "Max results per domain (default: 10)",
        required: false,
      },
    ],
  },
  {
    name: "generate_content",
    description:
      "Generate structured rich content (headings, lists, callouts, tables, etc.).",
    params: [
      {
        name: "target",
        type: "string (note | memo)",
        description: "Target entity type",
        required: true,
      },
      {
        name: "structure",
        type: "array",
        description: "Array of content blocks",
        required: true,
      },
      {
        name: "target_id",
        type: "string",
        description: "Existing note/memo ID to update",
        required: false,
      },
      {
        name: "title",
        type: "string",
        description: "Title for new note",
        required: false,
      },
    ],
  },
  {
    name: "format_content",
    description:
      "Read and restructure existing note/memo content. Supports wrapping, inserting, or replacing.",
    params: [
      {
        name: "target",
        type: "string (note | memo)",
        description: "Target entity type",
        required: true,
      },
      {
        name: "operations",
        type: "array",
        description: "Operations to apply",
        required: true,
      },
      {
        name: "target_id",
        type: "string",
        description: "Note ID",
        required: false,
      },
      {
        name: "target_date",
        type: "string",
        description: "Memo date (YYYY-MM-DD)",
        required: false,
      },
    ],
  },
];

function ToolCard({ tool }: { tool: McpTool }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="border border-notion-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-notion-hover/50 transition-colors"
      >
        {expanded ? (
          <ChevronDown size={16} className="text-notion-text-secondary" />
        ) : (
          <ChevronRight size={16} className="text-notion-text-secondary" />
        )}
        <code className="text-sm font-semibold text-notion-accent">
          {tool.name}
        </code>
        <span className="text-xs text-notion-text-secondary ml-2 flex-1 truncate">
          {tool.description}
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-3 border-t border-notion-border">
          <p className="text-sm text-notion-text-secondary mt-2 mb-3">
            {tool.description}
          </p>
          {tool.params.length > 0 && (
            <>
              <p className="text-xs font-semibold text-notion-text mb-1">
                {t("settings.claude.toolParameters")}
              </p>
              <div className="space-y-1">
                {tool.params.map((p) => (
                  <div key={p.name} className="flex items-start gap-2 text-xs">
                    <code className="text-notion-accent whitespace-nowrap">
                      {p.name}
                    </code>
                    <span className="text-notion-text-secondary">{p.type}</span>
                    <span
                      className={`text-[10px] px-1 rounded ${p.required ? "bg-red-500/10 text-red-500" : "bg-notion-hover text-notion-text-secondary"}`}
                    >
                      {p.required
                        ? t("settings.claude.required")
                        : t("settings.claude.optional")}
                    </span>
                    <span className="text-notion-text-secondary flex-1">
                      — {p.description}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function McpToolsList() {
  const { t } = useTranslation();

  return (
    <div>
      <p className="text-sm text-notion-text-secondary mb-4">
        {t("settings.claude.mcpToolsDescription")}
      </p>
      <div className="space-y-2">
        {MCP_TOOLS.map((tool) => (
          <ToolCard key={tool.name} tool={tool} />
        ))}
      </div>
    </div>
  );
}
