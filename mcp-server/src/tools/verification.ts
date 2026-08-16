import { defineTool, type ToolDefinition } from "./defineTool.js";
import {
  seedVerificationState,
  readVerificationState,
  cleanupVerificationState,
} from "../handlers/verificationHandlers.js";

/**
 * Verification tools (#895). One file per handler domain, so adding a tool
 * touches only its own domain instead of the middle of a 1,120-line array.
 */
export const VERIFICATION_TOOLS: ToolDefinition[] = [
  /*
   * The verification harness (#700). All three refuse to run unless the
   * server was started in verification mode, against the dedicated
   * verification account — see src/utils/verification.ts.
   */
  defineTool({
    name: "seed_verification_state",
    description:
      "VERIFICATION ONLY. Build a known state on one day — todos, events and notes — so a change can be checked without arranging data by hand in the UI. " +
      "Writes through the ordinary create tools, records every row it creates in a ledger, and returns a run_id; " +
      "read_verification_state reads that run back and cleanup_verification_state deletes exactly it. " +
      "Disabled unless the server runs in verification mode against the verification account.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description:
            "Day to place the fixture on, YYYY-MM-DD (default: today in local time)",
        },
        preset: {
          type: "string",
          enum: ["busy_day"],
          description:
            "Ready-made fixture. busy_day = two overlapping events + an all-day event + a done todo + an open todo + an undated todo.",
        },
        items: {
          type: "array",
          description:
            "Items to create, appended after any preset. At least one item (here or from a preset) is required.",
          items: {
            type: "object",
            properties: {
              kind: {
                type: "string",
                enum: ["task", "event", "note"],
                description:
                  "What to create. Dailies are not seedable: their id comes from the date, so a seeded one cannot be told apart from a real entry.",
              },
              title: {
                type: "string",
                description:
                  "Title (a [verify] marker is prepended). Defaults to 'kind N'.",
              },
              content: {
                type: "string",
                description: "Markdown body (todo and note)",
              },
              status: {
                type: "string",
                enum: ["not_started", "done"],
                description: "Todo status (todo only, default: not_started)",
              },
              start_time: {
                type: "string",
                description:
                  "HH:MM. Event: its start. Todo: schedules it at that time on the day — a todo with no time and no is_all_day stays undated.",
              },
              end_time: {
                type: "string",
                description: "HH:MM. Event: its end. Todo: its scheduled end.",
              },
              is_all_day: {
                type: "boolean",
                description:
                  "All-day item. An all-day event stores no times; an all-day todo lands on the day's local midnight.",
              },
              memo: { type: "string", description: "Event memo (event only)" },
            },
            required: ["kind"],
          },
        },
        label: {
          type: "string",
          description:
            "Free-text note stored with the run (e.g. the Issue being verified)",
        },
      },
    },
    handler: seedVerificationState,
  }),

  defineTool({
    name: "read_verification_state",
    description:
      "VERIFICATION ONLY. Read what the DB actually stores, without going through the UI: both rows of the 2-row model (items_meta + <role>_payload) in one object per item. " +
      "Soft-deleted items are included and flagged, so 'the screen stopped showing it' and 'the row is gone' can be told apart. " +
      "Select by run_id (a seed run), date (everything on one local day), or id (one item) — exactly one of the three.",
    inputSchema: {
      type: "object" as const,
      properties: {
        run_id: {
          type: "string",
          description: "A run_id returned by seed_verification_state",
        },
        date: {
          type: "string",
          description:
            "Local day (YYYY-MM-DD): events on it plus todos scheduled into it",
        },
        id: { type: "string", description: "A single item id" },
      },
    },
    handler: readVerificationState,
  }),

  defineTool({
    name: "cleanup_verification_state",
    description:
      "VERIFICATION ONLY. Delete the rows seeded earlier — read from the ledger, not from the caller's memory — hard, so nothing is left in the trash. " +
      "Defaults to every recorded run; pass run_id for one. Rows that fail to delete stay in the ledger so a re-run finishes them. " +
      "Retire the verification account only after this reports the ledger empty: user_id has no FK to auth.users, so rows outlive a deleted account.",
    inputSchema: {
      type: "object" as const,
      properties: {
        run_id: {
          type: "string",
          description: "Clean one run (default: every run in the ledger)",
        },
        dry_run: {
          type: "boolean",
          description: "Report what would be deleted and delete nothing",
        },
      },
    },
    handler: cleanupVerificationState,
  }),
];
