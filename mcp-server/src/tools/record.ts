import { defineTool, type ToolDefinition } from "./defineTool.js";
import {
  createRecord,
  deleteRecord,
  listExtensionApps,
  listRecords,
} from "../handlers/recordHandlers.js";

/**
 * Extension-app record tools (#2163). One file per handler domain (#895); the
 * rules — retry key, dims, who is calling — are in recordHandlers.ts.
 */
export const RECORD_TOOLS: ToolDefinition[] = [
  defineTool({
    name: "create_record",
    description:
      "Record one number with a time: an expense, a weight, hours slept. " +
      "Returns { id, created }. With external_id, sending the same call again returns the same id and created: false and adds no row; " +
      "the same external_id with different content fails with code idempotency_key_reused. " +
      "source_app is who recorded it and defaults to 'claude' (the owner's own Claude).",
    inputSchema: {
      type: "object" as const,
      properties: {
        kind: {
          type: "string",
          description:
            "What the number is, e.g. expense / weight / sleep. Lower-case letters, digits and _, starting with a letter, up to 32 characters. The caller picks the word.",
        },
        value: {
          type: "number",
          description:
            "The number itself, e.g. 450 for 450 JPY. May be negative or fractional.",
        },
        occurred_at: {
          type: "string",
          description:
            "When it happened, ISO 8601 with an offset, e.g. 2026-10-11T12:10:00+09:00. Defaults to now.",
        },
        unit: {
          type: "string",
          description: "Unit of the value, e.g. JPY / kg / min.",
        },
        dims: {
          type: "object",
          description:
            "Attributes of the record, e.g. { category: 'food', shop: 'cafe' }. Values are strings, numbers or booleans; at most 20 keys; keys are lower-case snake_case.",
        },
        note: { type: "string", description: "A free-text remark." },
        external_id: {
          type: "string",
          description:
            "The caller's own id for this record, 1-200 characters. Makes a retry safe (see above). Unique per source_app.",
        },
        source_app: {
          type: "string",
          description:
            "Who recorded it: 'claude' (default) or an extension app's slug.",
        },
      },
      required: ["kind", "value"],
    },
    handler: createRecord,
  }),

  defineTool({
    name: "list_records",
    description:
      "Read recorded numbers, newest first. Filter by kind, source_app and a period. " +
      "Without group_by (or 'none') returns { range, records, hasMore }. " +
      "With group_by day / week / month returns { range, group_by, kind, buckets }, buckets being { period, count, sum, avg, min, max, latest } oldest first (latest = the value of the period's newest record), " +
      "one per period that has records. A week is Sunday-start and its period is its first day (2026-10-04); a month is 2026-10. " +
      "A grouped answer is about one kind, so pass kind when the range holds several (the error names them).",
    inputSchema: {
      type: "object" as const,
      properties: {
        kind: { type: "string", description: "Only this kind, e.g. expense." },
        source_app: {
          type: "string",
          description: "Only records from this app ('claude' or a slug).",
        },
        from: {
          type: "string",
          description:
            "Start of the period. YYYY-MM-DD is a local day, inclusive; an ISO 8601 date and time with an offset is an instant, inclusive.",
        },
        to: {
          type: "string",
          description:
            "End of the period. YYYY-MM-DD is a local day and INCLUDES that day; an ISO 8601 date and time with an offset is an instant and is excluded.",
        },
        group_by: {
          type: "string",
          enum: ["none", "day", "week", "month"],
          description:
            "none (default) lists the records; day / week / month totals them per period.",
        },
        limit: {
          type: "number",
          description:
            "Max records to return when not grouped (default 50, at most 500). Grouped answers always cover the whole period.",
        },
      },
    },
    handler: listRecords,
  }),

  defineTool({
    name: "delete_record",
    description:
      "Delete one record for good (records have no trash). Returns { success, id }. Fails with code not_found when there is no such record. " +
      "Through the extension-app gateway an app deletes only the records it made; any other fails with code forbidden.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          description: "The record's id (from create_record or list_records).",
        },
      },
      required: ["id"],
    },
    handler: deleteRecord,
  }),

  defineTool({
    name: "list_extension_apps",
    description:
      "The extension apps registered in the Apps section, in their display order. " +
      "Each has slug, name, url, icon, description, sort_order, plus last_record_at (when its newest record happened, or null) and records_30d (how many records it sent in the last 30 days). " +
      "The slug is the source_app of the records it sent; 'claude' is not an app and does not appear here.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
    handler: listExtensionApps,
  }),
];
