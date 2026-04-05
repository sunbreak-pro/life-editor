import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ToolParam {
  name: string;
  type: string;
  required: boolean;
}

interface McpTool {
  name: string;
  params: ToolParam[];
}

interface ToolCategory {
  key: string;
  tools: McpTool[];
}

const TOOL_CATEGORIES: ToolCategory[] = [
  {
    key: "tasks",
    tools: [
      {
        name: "list_tasks",
        params: [
          {
            name: "status",
            type: "string (todo | in_progress | done)",
            required: false,
          },
          {
            name: "date_range",
            type: "object { start, end }",
            required: false,
          },
          { name: "folder_id", type: "string", required: false },
        ],
      },
      {
        name: "get_task",
        params: [{ name: "id", type: "string", required: true }],
      },
      {
        name: "get_task_tree",
        params: [
          { name: "root_id", type: "string", required: false },
          { name: "include_done", type: "boolean", required: false },
          { name: "max_depth", type: "number", required: false },
        ],
      },
      {
        name: "create_task",
        params: [
          { name: "title", type: "string", required: true },
          { name: "parent_id", type: "string", required: false },
          { name: "scheduled_at", type: "string", required: false },
          { name: "scheduled_end_at", type: "string", required: false },
          { name: "is_all_day", type: "boolean", required: false },
        ],
      },
      {
        name: "update_task",
        params: [
          { name: "id", type: "string", required: true },
          { name: "title", type: "string", required: false },
          {
            name: "status",
            type: "string (todo | in_progress | done)",
            required: false,
          },
          { name: "content", type: "string", required: false },
        ],
      },
      {
        name: "delete_task",
        params: [{ name: "id", type: "string", required: true }],
      },
    ],
  },
  {
    key: "memos",
    tools: [
      {
        name: "get_memo",
        params: [{ name: "date", type: "string (YYYY-MM-DD)", required: true }],
      },
      {
        name: "upsert_memo",
        params: [
          { name: "date", type: "string (YYYY-MM-DD)", required: true },
          { name: "content", type: "string", required: true },
        ],
      },
    ],
  },
  {
    key: "notes",
    tools: [
      {
        name: "list_notes",
        params: [{ name: "query", type: "string", required: false }],
      },
      {
        name: "create_note",
        params: [
          { name: "title", type: "string", required: true },
          { name: "content", type: "string", required: false },
        ],
      },
      {
        name: "update_note",
        params: [
          { name: "id", type: "string", required: true },
          { name: "title", type: "string", required: false },
          { name: "content", type: "string", required: false },
        ],
      },
    ],
  },
  {
    key: "schedule",
    tools: [
      {
        name: "list_schedule",
        params: [{ name: "date", type: "string (YYYY-MM-DD)", required: true }],
      },
      {
        name: "create_schedule_item",
        params: [
          { name: "date", type: "string (YYYY-MM-DD)", required: true },
          { name: "title", type: "string", required: true },
          { name: "start_time", type: "string (HH:MM)", required: true },
          { name: "end_time", type: "string (HH:MM)", required: true },
          { name: "is_all_day", type: "boolean", required: false },
          { name: "note_id", type: "string", required: false },
          { name: "content", type: "string", required: false },
        ],
      },
      {
        name: "update_schedule_item",
        params: [
          { name: "id", type: "string", required: true },
          { name: "title", type: "string", required: false },
          { name: "start_time", type: "string (HH:MM)", required: false },
          { name: "end_time", type: "string (HH:MM)", required: false },
          { name: "memo", type: "string", required: false },
          { name: "is_all_day", type: "boolean", required: false },
          { name: "content", type: "string", required: false },
        ],
      },
      {
        name: "delete_schedule_item",
        params: [{ name: "id", type: "string", required: true }],
      },
      {
        name: "toggle_schedule_complete",
        params: [{ name: "id", type: "string", required: true }],
      },
    ],
  },
  {
    key: "search",
    tools: [
      {
        name: "search_all",
        params: [
          { name: "query", type: "string", required: true },
          {
            name: "domains",
            type: "array (tasks | memos | notes)",
            required: false,
          },
          { name: "limit", type: "number", required: false },
        ],
      },
    ],
  },
  {
    key: "content",
    tools: [
      {
        name: "generate_content",
        params: [
          { name: "target", type: "string (note | memo)", required: true },
          { name: "structure", type: "array", required: true },
          { name: "target_id", type: "string", required: false },
          { name: "title", type: "string", required: false },
        ],
      },
      {
        name: "format_content",
        params: [
          { name: "target", type: "string (note | memo)", required: true },
          { name: "operations", type: "array", required: true },
          { name: "target_id", type: "string", required: false },
          { name: "target_date", type: "string (YYYY-MM-DD)", required: false },
        ],
      },
    ],
  },
  {
    key: "wikiTags",
    tools: [
      {
        name: "list_wiki_tags",
        params: [{ name: "query", type: "string", required: false }],
      },
      {
        name: "tag_entity",
        params: [
          { name: "tag_name", type: "string", required: true },
          { name: "entity_id", type: "string", required: true },
          {
            name: "entity_type",
            type: "string (task | memo | note)",
            required: true,
          },
        ],
      },
      {
        name: "search_by_tag",
        params: [
          { name: "tag_name", type: "string", required: true },
          {
            name: "entity_type",
            type: "string (task | memo | note)",
            required: false,
          },
        ],
      },
      {
        name: "get_entity_tags",
        params: [{ name: "entity_id", type: "string", required: true }],
      },
    ],
  },
];

function ToolCard({ tool }: { tool: McpTool }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

  const description = t(`settings.claude.tools.${tool.name}.description`);

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
          {description}
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-3 border-t border-notion-border">
          <p className="text-sm text-notion-text-secondary mt-2 mb-3">
            {description}
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
                      —{" "}
                      {t(`settings.claude.tools.${tool.name}.params.${p.name}`)}
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
    <div data-section-id="claude-mcpTools">
      <p className="text-sm text-notion-text-secondary mb-4">
        {t("settings.claude.mcpToolsDescription")}
      </p>
      <div className="space-y-6">
        {TOOL_CATEGORIES.map((category) => (
          <div key={category.key}>
            <h3 className="text-xs font-semibold text-notion-text-secondary uppercase tracking-wider mb-2">
              {t(`settings.claude.toolCategories.${category.key}`)}
            </h3>
            <div className="space-y-2">
              {category.tools.map((tool) => (
                <ToolCard key={tool.name} tool={tool} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
