import { defineTool, type ToolDefinition } from "./tools/defineTool.js";
import { currentCaller } from "./callerContext.js";
import { findByOriginKey, type KeyedRow } from "./utils/originKey.js";
import { unknownArgNames, validateToolArgs } from "./utils/toolSchema.js";
import { CodedError, invalidArguments, notFoundError } from "./errorCodes.js";

/*
 * Update or delete an item by the key the app made it with (#2148, plan R6).
 *
 * An app that creates with `idempotency_key` already holds the one id it needs
 * — its own. These two tools let it come back to the item with that, instead of
 * keeping a table from its ids to life-editor's.
 *
 * WHY THE OWNERSHIP RULE NEEDS NO CHECK HERE. The key is looked up under the
 * CALLER'S app name (originKey.ts: `origin_app = <caller>`), so the only items
 * it can find are the ones that app made. Another app's key, the owner's items
 * and life-editor's own all come back as "not found" — which is also the right
 * answer to give: it says nothing about whether such an item exists. The
 * per-id tools get the same rule from gatewayGuard.ts; this is the same rule
 * reached from the other side.
 *
 * THE WORK IS THE EXISTING TOOLS'. `update_by_external_id` hands `changes` to
 * the update tool for the item's kind (update_todo / update_note /
 * update_schedule_item) with the item's id filled in, validated against THAT
 * tool's schema. So a rule added to one of them reaches this path with it, and
 * a field the tool does not know is refused rather than ignored.
 */

const KINDS: Record<string, { update: string; delete: string }> = {
  task: { update: "update_todo", delete: "delete_todo" },
  note: { update: "update_note", delete: "delete_note" },
  event: {
    update: "update_schedule_item",
    delete: "delete_schedule_item",
  },
};

/** The names of the tools below, for the guard's accounting. */
export const EXTERNAL_ID_TOOL_NAMES = [
  "update_by_external_id",
  "delete_by_external_id",
] as const;

async function resolve(
  externalId: string,
): Promise<{ row: KeyedRow; kind: { update: string; delete: string } }> {
  const caller = currentCaller();
  if (!caller) {
    throw new CodedError(
      "forbidden",
      "Forbidden: no caller for this gateway call",
    );
  }
  const row = await findByOriginKey(externalId);
  const kind = row ? KINDS[row.role] : undefined;
  if (!row || !kind) {
    throw notFoundError(
      `No item created by this app has external_id "${externalId}"`,
    );
  }
  return { row, kind };
}

/**
 * `find` hands over the shared definition of a tool by name, so these two never
 * hold a copy of the schemas they delegate to.
 */
export function buildExternalIdTools(
  find: (name: string) => ToolDefinition,
): ToolDefinition[] {
  return [
    defineTool({
      name: "update_by_external_id",
      description:
        "Update an item this app created, naming it by the idempotency_key it was created with (its external_id) instead of its id. " +
        "`changes` holds the fields of the matching update tool — update_todo, update_note or update_schedule_item, by what the item is — without `id`. " +
        "Returns that tool's result. An item the app did not create is reported as not found; a deleted one as already_deleted.",
      inputSchema: {
        type: "object" as const,
        properties: {
          external_id: {
            type: "string",
            description:
              "The idempotency_key the item was created with (this app's own)",
          },
          changes: {
            type: "object",
            description:
              "The update tool's fields to change, e.g. { title: 'New' } or { start_time: '10:00' }",
          },
        },
        required: ["external_id", "changes"],
      },
      handler: async (args: {
        external_id: string;
        changes: Record<string, unknown>;
      }) => {
        const { row, kind } = await resolve(args.external_id);
        if (row.is_deleted) {
          throw new CodedError(
            "already_deleted",
            `The item with external_id "${args.external_id}" was deleted, so it was not updated.`,
          );
        }
        if ("id" in args.changes) {
          throw invalidArguments(
            "changes must not contain id: the item is named by external_id",
          );
        }
        const inner = find(kind.update);
        const innerArgs = { ...args.changes, id: row.id };
        validateToolArgs(inner.name, inner.inputSchema, innerArgs);
        const ignored = unknownArgNames(inner.inputSchema, innerArgs);
        if (ignored.length > 0) {
          throw invalidArguments(
            `${inner.name} does not accept ${ignored.join(", ")} in changes`,
          );
        }
        return inner.run(innerArgs);
      },
    }),

    defineTool({
      name: "delete_by_external_id",
      description:
        "Delete (to the trash) an item this app created, naming it by the idempotency_key it was created with (its external_id). " +
        "Deleting an item that is already deleted succeeds with the same answer, so a retry is safe. An item the app did not create is reported as not found.",
      inputSchema: {
        type: "object" as const,
        properties: {
          external_id: {
            type: "string",
            description:
              "The idempotency_key the item was created with (this app's own)",
          },
        },
        required: ["external_id"],
      },
      handler: async (args: { external_id: string }) => {
        const { row, kind } = await resolve(args.external_id);
        if (row.is_deleted) {
          return { success: true, id: row.id, softDeleted: true };
        }
        return find(kind.delete).run({ id: row.id });
      },
    }),
  ];
}
