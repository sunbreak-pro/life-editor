import { buildRegistry, type ToolRegistry } from "./registry.js";
import {
  EXTENSION_TOOL_ACCESS,
  EXTENSION_TOOL_DEFINITIONS,
} from "./extensionGateway.js";
import { currentCaller, type Caller } from "./callerContext.js";
import { getSupabase } from "./supabase.js";
import type { ToolDefinition } from "./tools/defineTool.js";

/*
 * What an extension app's key may do, checked before a handler runs
 * (#2146, plan R3 / R6, D-20261007-main-4 = B).
 *
 * The rule, in two halves:
 *   - READ across life-editor: every read tool in the gateway's set, whoever
 *     made the item.
 *   - WRITE only what the app made: create, and then update / delete / tag its
 *     own items. A write aimed at an item the app did not create — the owner's,
 *     life-editor's own, another app's — is refused here, before the handler
 *     reaches Supabase.
 *
 * "Made by this app" is `items_meta.origin_app` (0038), stamped by `insertItem`
 * from the caller context. A row with a NULL origin was made by life-editor
 * itself or by the owner's own key, so it is nobody's but the owner's.
 *
 * The check and the write are two statements, not one. That is a window an
 * attacker could use only by racing the owner's own edit of the same item, and
 * the worst it buys is one extra write to an item the app already created; a
 * database-side guard would close it, and needs a function this issue does not
 * own.
 */

/**
 * The write tools that act on an EXISTING item, and the argument naming it.
 * Every write tool in the gateway's set is either a create or listed here:
 * tests/gatewayGuard.test.ts fails when a new write tool is neither, so adding
 * one cannot silently skip the ownership check.
 */
export const OWNED_ITEM_ARG: Readonly<Record<string, string>> = {
  update_todo: "id",
  delete_todo: "id",
  update_note: "id",
  delete_note: "id",
  update_schedule_item: "id",
  delete_schedule_item: "id",
  set_schedule_complete: "id",
  set_schedule_dismissed: "id",
  tag_entity: "entity_id",
  untag_entity: "entity_id",
};

/**
 * A create names no item to change, but some creates point at an existing one:
 * `create_todo`'s `parent_id` puts the new todo under it and takes a place in
 * its order. That is a write into someone else's tree unless the app made the
 * parent, so it is checked like the id of an update. tests/gatewayGuard.test.ts
 * fails when a create tool gains an `*_id` argument that is not listed here.
 */
export const CREATE_ITEM_ARG: Readonly<Record<string, string>> = {
  create_todo: "parent_id",
};

/** Create tools: they act on nothing that exists, so there is nothing to own yet. */
export const CREATE_TOOLS: readonly string[] = [
  "create_todo",
  "create_note",
  "create_schedule_item",
];

export function accessOf(toolName: string): "read" | "write" | undefined {
  return (EXTENSION_TOOL_ACCESS as Record<string, "read" | "write">)[toolName];
}

/** Whether `caller` may see `toolName` at all — the scope half of the rule. */
export function scopeAllows(caller: Caller, toolName: string): boolean {
  const access = accessOf(toolName);
  return access !== undefined && caller.scopes.includes(access);
}

/**
 * Run before every gateway tool call. Throws — and so the handler never runs —
 * when the caller's scopes do not cover the tool, or when a write names an item
 * another app (or the owner) made.
 */
export async function assertMayRun(
  def: ToolDefinition,
  args: Record<string, unknown>,
): Promise<void> {
  const caller = currentCaller();
  // The gateway always runs a call as a caller. Finding none means a path that
  // skipped the Worker's authentication, and that must not run as the owner.
  if (!caller) throw new Error("Forbidden: no caller for this gateway call");

  const access = accessOf(def.name);
  if (access === undefined || !caller.scopes.includes(access)) {
    throw new Error(
      `Forbidden: this key has no ${access ?? "access"} scope for ${def.name}`,
    );
  }

  for (const argName of [OWNED_ITEM_ARG[def.name], CREATE_ITEM_ARG[def.name]]) {
    if (argName === undefined) continue;
    const id = args[argName];
    // A missing id is validation's to refuse; an optional one may be absent.
    if (typeof id === "string") await assertCreatedBy(id, caller);
  }
}

/** Throw unless `id` is an item `caller`'s app created. A missing row passes. */
async function assertCreatedBy(id: string, caller: Caller): Promise<void> {
  const { client } = await getSupabase();
  const { data, error } = await client
    .from("items_meta")
    .select("origin_app")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`origin check: ${error.message}`);

  // No such row: let the handler say "not found" in its own words.
  if (!data) return;

  if ((data as { origin_app: string | null }).origin_app !== caller.app) {
    throw new Error(`Forbidden: ${id} was not created by ${caller.app}`);
  }
}

/** The gateway's registry: the extension set, behind `assertMayRun`. */
export const gatewayRegistry: ToolRegistry = buildRegistry(
  EXTENSION_TOOL_DEFINITIONS,
  { beforeRun: assertMayRun },
);

/** The same registry as one caller sees it: only the tools its scopes cover. */
export function registryFor(caller: Caller): ToolRegistry {
  return {
    tools: gatewayRegistry.tools.filter((tool) =>
      scopeAllows(caller, tool.name),
    ),
    call: (name, args) => gatewayRegistry.call(name, args),
  };
}
