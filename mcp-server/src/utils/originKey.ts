import { createHash } from "node:crypto";
import { getSupabase } from "../supabase.js";
import { currentCaller } from "../callerContext.js";
import { CodedError, invalidArguments } from "../errorCodes.js";
import type { ItemRole } from "./items.js";

/*
 * The retry key of an extension app's create (#2148, plan R5,
 * D-20261007-main-6 = A; columns: 0038).
 *
 * The gateway promises "at least once": an app that never saw the answer sends
 * the same create again. With `idempotency_key` the second call returns the
 * first one's item instead of making a second one.
 *
 * THREE OUTCOMES FOR A KEY THAT ALREADY EXISTS, decided by what is stored:
 *   - same content            → the item that was made (a replay);
 *   - different content       → refused, `idempotency_key_reused`: the app is
 *                               reusing a key for something else, and silently
 *                               returning the old item would hide that;
 *   - the item was deleted    → refused, `already_deleted`: the owner threw it
 *                               away, and a retry must not bring it back.
 * The content check comes first, so a reused key is reported as such whether or
 * not its item has since been deleted.
 *
 * "SAME CONTENT" is a SHA-256 of the tool name and its arguments (minus the key
 * itself), kept in `items_meta.origin_request_hash`. Arguments are put in key
 * order and null counts as absent, matching how the validator reads them, so
 * two spellings of one request hash alike.
 *
 * The key belongs to (account, app): the unique index is
 * (user_id, origin_app, origin_key), and the lookup below goes through the
 * caller's own Supabase session, so one app can neither see nor collide with
 * another's keys.
 *
 * OUTSIDE THE GATEWAY the argument means nothing. A call with no caller — the
 * stdio server, the phone's connector — does not declare it, and a handler
 * that is handed it anyway ignores it: there is no app to key it under.
 */

/** What `insertItem` writes next to `origin_app` for a keyed create. */
export interface OriginKey {
  key: string;
  hash: string;
}

/** A unique-violation on the (user, app, key) index: a concurrent twin won. */
export class DuplicateOriginKeyError extends Error {
  constructor() {
    super("origin_key already exists");
    this.name = "DuplicateOriginKeyError";
  }
}

const MAX_KEY_LENGTH = 200;

/** JSON with object keys sorted and null/undefined members dropped. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const name of Object.keys(value).sort()) {
      const member = (value as Record<string, unknown>)[name];
      if (member === undefined || member === null) continue;
      out[name] = canonical(member);
    }
    return out;
  }
  return value;
}

/** SHA-256 (hex) of a create request, `idempotency_key` excluded. */
export function requestHash(
  tool: string,
  args: Record<string, unknown>,
): string {
  const { idempotency_key: _key, ...rest } = args;
  return createHash("sha256")
    .update(JSON.stringify({ tool, args: canonical(rest) }))
    .digest("hex");
}

/**
 * The key of this create, or undefined when it has none or nobody is calling
 * through the gateway.
 */
export function originKeyFor(
  tool: string,
  args: Record<string, unknown>,
): OriginKey | undefined {
  const key = args.idempotency_key;
  if (key === undefined || key === null) return undefined;
  if (!currentCaller()) return undefined;
  if (
    typeof key !== "string" ||
    key.length < 1 ||
    key.length > MAX_KEY_LENGTH
  ) {
    throw invalidArguments(
      `Invalid arguments for ${tool}: idempotency_key must be 1-${MAX_KEY_LENGTH} characters`,
    );
  }
  return { key, hash: requestHash(tool, args) };
}

export interface KeyedRow {
  id: string;
  role: string;
  is_deleted: boolean;
  origin_request_hash: string | null;
}

/** The caller's own item under `key`, deleted or not. */
export async function findByOriginKey(key: string): Promise<KeyedRow | null> {
  const caller = currentCaller();
  if (!caller) return null;
  const { client } = await getSupabase();
  const { data, error } = await client
    .from("items_meta")
    .select("id, role, is_deleted, origin_request_hash")
    .eq("origin_app", caller.app)
    .eq("origin_key", key)
    .maybeSingle();
  if (error) throw new Error(`get items_meta by origin_key: ${error.message}`);
  return (data as KeyedRow | null) ?? null;
}

/** The id this key already made, null for a new key, or the refusal. */
async function existingId(
  role: ItemRole,
  origin: OriginKey,
): Promise<string | null> {
  const row = await findByOriginKey(origin.key);
  if (!row) return null;
  if (row.role !== role || row.origin_request_hash !== origin.hash) {
    throw new CodedError(
      "idempotency_key_reused",
      `idempotency_key "${origin.key}" was already used for a different request. ` +
        `Send the same arguments to retry it, or use a new key for new content.`,
    );
  }
  if (row.is_deleted) {
    throw new CodedError(
      "already_deleted",
      `The item created with idempotency_key "${origin.key}" was deleted, so it was not created again. ` +
        `Use a new key to create a new one.`,
    );
  }
  return row.id;
}

/**
 * Make an item at most once per key.
 *
 * `create` writes the item and returns its id (and must hand `origin` to
 * `insertItem`); `load` reads an item back in the tool's result shape. With no
 * key this is just `load(await create())`.
 */
export async function createOnce<T>(args: {
  tool: string;
  role: ItemRole;
  input: Record<string, unknown>;
  create: (origin: OriginKey | undefined) => Promise<string>;
  load: (id: string) => Promise<T>;
}): Promise<T> {
  const origin = originKeyFor(args.tool, args.input);
  if (!origin) return args.load(await args.create(undefined));

  const existing = await existingId(args.role, origin);
  if (existing) return args.load(existing);

  try {
    return await args.load(await args.create(origin));
  } catch (error) {
    // Two copies of one request raced past the lookup; the index let one in.
    // The loser answers as a replay of the winner.
    if (!(error instanceof DuplicateOriginKeyError)) throw error;
    const winner = await existingId(args.role, origin);
    if (winner) return args.load(winner);
    throw error;
  }
}
