import type { ToolDefinition } from "./tools/defineTool.js";
import { REMOTE_TOOL_DEFINITIONS } from "./remoteTools.js";
import { buildRegistry, type ToolRegistry } from "./registry.js";
import type { ObjectSchema } from "./utils/toolSchema.js";
import { buildExternalIdTools } from "./externalIdTools.js";
import { ERROR_CODES } from "./errorCodes.js";

/*
 * The extension-app gateway's tool set, and the contract that describes it
 * (#2144 / plan .claude/docs/vision/plans/2026-10-07-extension-app-gateway.md,
 * step 2).
 *
 * WHY A CONTRACT FILE. An extension app (SubscRecorder first) is built by an
 * unattended loop that never holds life-editor credentials: it is judged
 * against a stand-in for this gateway. SubscRecorder's stand-in copied the
 * `required` arrays and nothing else, so it accepted a timed event with no
 * times — a rule `required` cannot say (schedule.ts: "start_time / end_time are
 * conditionally required") — and every check passed against a server that did
 * not exist. `buildGatewaySpec` writes down everything a stand-in needs to be
 * the same server: input, required, conditional required, result, failure.
 *
 * WHY A SEPARATE FILE FROM mcpToolCatalog.json. That catalog is Settings'
 * "what can Claude do" list for every tool, built from the stdio registry.
 * This contract is a promise to another repository about a smaller set, with a
 * version. Merging them would make a Settings-only change look like a gateway
 * change, and the other way round.
 *
 * WHY THE SET IS A NAME LIST. The gateway publishes a subset of
 * REMOTE_TOOL_DEFINITIONS, picked by name, so the handlers and the validator
 * stay the ones the phone and the desktop use — a stand-in that matches them
 * matches all three. A name that disappears from the remote set fails the
 * module load below instead of shrinking the gateway without a version bump.
 */

/**
 * The gateway's semver. Bump it with the spec: major for a change that breaks
 * a caller written against the old one (a tool or property removed, a type
 * narrowed, a new required argument, a new conditional rule), minor for an
 * addition, patch for wording. `classifySpecChange` decides which one a diff
 * is, and `scripts/dump-gateway-spec.mjs` refuses to write a spec whose
 * version moved less than that.
 */
export const EXTENSION_GATEWAY_VERSION = "2.0.0";

/** Bumped only if the SHAPE of the spec file itself changes. */
export const SPEC_FORMAT = 1;

/**
 * What an extension app may call (plan R3, D-20261007-main-4 = B: create /
 * read / update / delete of its own items, plus reads across life-editor).
 * Left out on purpose: routines, daily notes, the briefing, content
 * generation, trash and restore, links, work sessions and goals — each is a
 * widening to decide separately, and a minor version bump adds it.
 *
 * The record tools (#2166) are the extension apps' own: an app records numbers
 * as itself and reads everyone's. Who "itself" is comes from the key, not the
 * arguments (handlers/recordHandlers.ts, "WHO IS CALLING").
 */
const EXTENSION_TOOLS = {
  list_todos: "read",
  get_todo: "read",
  create_todo: "write",
  update_todo: "write",
  delete_todo: "write",
  list_notes: "read",
  get_note: "read",
  create_note: "write",
  update_note: "write",
  delete_note: "write",
  list_schedule: "read",
  create_schedule_item: "write",
  update_schedule_item: "write",
  delete_schedule_item: "write",
  set_schedule_complete: "write",
  set_schedule_dismissed: "write",
  list_wiki_tags: "read",
  get_entity_tags: "read",
  search_by_tag: "read",
  tag_entity: "write",
  untag_entity: "write",
  search_all: "read",
  update_by_external_id: "write",
  delete_by_external_id: "write",
  create_record: "write",
  list_records: "read",
  delete_record: "write",
  list_extension_apps: "read",
} as const satisfies Record<string, "read" | "write">;

/** Each tool's access, for the gateway's scope check (gatewayGuard.ts). */
export const EXTENSION_TOOL_ACCESS: Readonly<Record<string, "read" | "write">> =
  EXTENSION_TOOLS;

export type ExtensionToolName = keyof typeof EXTENSION_TOOLS;

const byName = new Map(REMOTE_TOOL_DEFINITIONS.map((def) => [def.name, def]));

/**
 * The three creates take a retry key here and nowhere else. The argument is
 * declared on the gateway's copy of each schema, not the shared one, so the
 * phone's connector and the desktop server neither advertise a key that has no
 * app to belong to nor change what they publish. The handlers read it from the
 * arguments and honour it only when a gateway caller is present
 * (utils/originKey.ts).
 */
const KEYED_CREATES: ReadonlySet<string> = new Set([
  "create_todo",
  "create_note",
  "create_schedule_item",
]);

const IDEMPOTENCY_KEY_SCHEMA = {
  type: "string",
  description:
    "A key of your own, 1-200 characters, that makes a retry safe: the same key with the same arguments returns the item the first call made " +
    "(and creates nothing); the same key with different arguments fails with code idempotency_key_reused; " +
    "a key whose item was since deleted fails with code already_deleted instead of creating it again. " +
    "The key is also the item's external_id for update_by_external_id and delete_by_external_id.",
} as const;

function withIdempotencyKey(def: ToolDefinition): ToolDefinition {
  return {
    ...def,
    inputSchema: {
      ...def.inputSchema,
      properties: {
        ...def.inputSchema.properties,
        idempotency_key: IDEMPOTENCY_KEY_SCHEMA,
      },
    },
  };
}

/**
 * On the gateway a record's source_app is the calling app's slug, always: the
 * handler takes it from the key (#2166). So the gateway's copy of
 * create_record does not declare the argument — an app that sends one gets
 * the undeclared-argument Note, instead of a value that is quietly replaced —
 * and its description says whose record it becomes. The shared definition,
 * which the phone's connector and the desktop server publish, keeps both.
 */
const CREATE_RECORD_ON_GATEWAY =
  "Record one number with a time: an expense, a weight, hours slept. " +
  "Returns { id, created }. With external_id, sending the same call again returns the same id and created: false and adds no row; " +
  "the same external_id with different content fails with code idempotency_key_reused. " +
  "The record's source_app is the calling app's slug, set from its key.";

function withCallerSourceApp(def: ToolDefinition): ToolDefinition {
  const { source_app: _sourceApp, ...properties } =
    def.inputSchema.properties ?? {};
  return {
    ...def,
    description: CREATE_RECORD_ON_GATEWAY,
    inputSchema: { ...def.inputSchema, properties },
  };
}

const remoteDefinition = (name: string): ToolDefinition => {
  const def = byName.get(name);
  if (!def) {
    throw new Error(
      `Extension gateway tool "${name}" is not in the remote tool set. ` +
        `Removing a tool is a breaking change: bump EXTENSION_GATEWAY_VERSION ` +
        `and drop it from EXTENSION_TOOLS together.`,
    );
  }
  return def;
};

/** Tools that exist only on the gateway (update/delete by external id). */
const gatewayOnly = new Map(
  buildExternalIdTools(remoteDefinition).map((def) => [def.name, def]),
);

export const EXTENSION_TOOL_DEFINITIONS: ToolDefinition[] = (
  Object.keys(EXTENSION_TOOLS) as ExtensionToolName[]
).map((name) => {
  const own = gatewayOnly.get(name);
  if (own) return own;
  const def = remoteDefinition(name);
  if (name === "create_record") return withCallerSourceApp(def);
  return KEYED_CREATES.has(name) ? withIdempotencyKey(def) : def;
});

/** The registry a gateway Worker serves: same validator, same handlers. */
export const extensionRegistry: ToolRegistry = buildRegistry(
  EXTENSION_TOOL_DEFINITIONS,
);

/* ---- conditional required ------------------------------------------------ */

/**
 * "These arguments are required, except when `field` equals `value`."
 *
 * A JSON Schema `required` array cannot say it, and the validator in
 * utils/toolSchema.ts implements only that subset — so the rule lives in the
 * handler, and here, as data a stand-in can read. `message` is what the
 * handler throws, word for word.
 */
export interface ConditionalRequired {
  require: string[];
  unless: { field: string; equals: unknown };
  message: string;
}

const CONDITIONAL_REQUIRED: Partial<
  Record<ExtensionToolName, ConditionalRequired[]>
> = {
  create_schedule_item: [
    {
      require: ["start_time", "end_time"],
      unless: { field: "is_all_day", equals: true },
      message: "start_time and end_time are required unless is_all_day is true",
    },
  ],
};

/**
 * Rules that depend on what is stored, so no argument-only check can apply
 * them. A stand-in has to hold state to honour these.
 */
const STATE_DEPENDENT_RULES: Partial<Record<ExtensionToolName, string[]>> = {
  update_schedule_item: [
    "is_all_day: false needs start_time and end_time, supplied in this call or already stored on the item. " +
      "The error is: start_time and end_time are required when turning is_all_day off (this item has none stored).",
  ],
  delete_schedule_item: [
    "An occurrence of a repeating event (routineId set) needs scope: this | future | all. Without it the call fails; " +
      "an event that is not an occurrence ignores scope.",
  ],
};

/** The messages of the rules in `tool`'s conditional list that `args` breaks. */
export function brokenConditionalRules(
  tool: string,
  args: Record<string, unknown>,
): string[] {
  const rules = CONDITIONAL_REQUIRED[tool as ExtensionToolName] ?? [];
  return rules
    .filter((rule) => args[rule.unless.field] !== rule.unless.equals)
    .filter((rule) =>
      rule.require.some(
        (name) => args[name] === undefined || args[name] === null,
      ),
    )
    .map((rule) => rule.message);
}

/* ---- results ------------------------------------------------------------- */

type JsonKind = "string" | "number" | "boolean" | "object" | "array" | "null";

/**
 * The top-level shape of a tool's result: which keys always come back, and
 * what kind each is. Values nested deeper are not pinned — a stand-in needs to
 * return something a caller can destructure, not to reproduce Postgres rows.
 * `type` may be a list where a column is nullable.
 */
export interface ResultShape {
  type: "object" | "array";
  required?: string[];
  properties?: Record<string, { type: JsonKind | JsonKind[] }>;
  description?: string;
}

const shape = (
  required: Record<string, JsonKind | JsonKind[]>,
  description?: string,
): ResultShape => ({
  type: "object",
  required: Object.keys(required),
  properties: Object.fromEntries(
    Object.entries(required).map(([key, type]) => [key, { type }]),
  ),
  ...(description ? { description } : {}),
});

const DEFINITIONS: Record<string, ResultShape> = {
  scheduleItem: shape({
    id: "string",
    date: "string",
    title: "string",
    startTime: ["string", "null"],
    endTime: ["string", "null"],
    completed: "boolean",
    completedAt: ["string", "null"],
    routineId: ["string", "null"],
    memo: ["string", "null"],
    isDismissed: "boolean",
    isAllDay: "boolean",
    isDeleted: "boolean",
    deletedAt: ["string", "null"],
    createdAt: "string",
    updatedAt: "string",
  }),
  todo: shape({
    id: "string",
    type: "string",
    title: "string",
    parentId: ["string", "null"],
    order: ["number", "null"],
    status: ["string", "null"],
    createdAt: "string",
    completedAt: ["string", "null"],
    scheduledAt: ["string", "null"],
    scheduledEndAt: ["string", "null"],
    isAllDay: ["boolean", "null"],
    timeMemo: ["string", "null"],
    content: ["string", "null"],
    contentText: "string",
  }),
  note: {
    ...shape({
      id: "string",
      type: "string",
      title: "string",
      isPinned: "boolean",
      hasPassword: "boolean",
      createdAt: "string",
      updatedAt: "string",
    }),
    description:
      "A note with a password carries locked: true and lockedReason instead of content and contentText.",
  },
  tag: shape({
    id: "string",
    name: "string",
    color: "string",
    createdAt: "string",
    updatedAt: "string",
  }),
  deleted: shape({ success: "boolean", id: "string", softDeleted: "boolean" }),
  record: shape({
    id: "string",
    source_app: "string",
    external_id: ["string", "null"],
    kind: "string",
    occurred_at: "string",
    value: "number",
    unit: ["string", "null"],
    dims: "object",
    note: ["string", "null"],
  }),
};

const REF = (name: string) => ({ $ref: `#/definitions/${name}` });

const RESULTS: Record<ExtensionToolName, ResultShape | { $ref: string }> = {
  list_todos: shape({ todos: "array", total: "number", hasMore: "boolean" }),
  get_todo: {
    ...shape({ tags: "array" }),
    description: "A todo (definitions.todo) plus tags.",
  },
  create_todo: REF("todo"),
  update_todo: REF("todo"),
  delete_todo: REF("deleted"),
  list_notes: shape({ notes: "array", total: "number", hasMore: "boolean" }),
  get_note: REF("note"),
  create_note: REF("note"),
  update_note: REF("note"),
  delete_note: REF("deleted"),
  list_schedule: shape({ scheduleItems: "array", scheduledTodos: "array" }),
  create_schedule_item: REF("scheduleItem"),
  update_schedule_item: REF("scheduleItem"),
  delete_schedule_item: shape(
    { success: "boolean", id: "string" },
    "Also softDeleted, or scope with routineId for an occurrence of a repeating event.",
  ),
  set_schedule_complete: REF("scheduleItem"),
  set_schedule_dismissed: REF("scheduleItem"),
  list_wiki_tags: {
    type: "array",
    description: "Each element is a tag (definitions.tag) plus usageCount.",
  },
  get_entity_tags: shape({ entityId: "string", tags: "array" }),
  search_by_tag: shape({ tag: "object", results: "array" }),
  tag_entity: shape({
    tag: "object",
    entityId: "string",
    entityType: "string",
  }),
  untag_entity: shape(
    { removed: "boolean" },
    "tag and entityId come back too when removed is true.",
  ),
  search_all: shape(
    { totalHits: "number" },
    "One key per searched domain (todos, dailies, notes), each { results, total, hasMore }.",
  ),
  update_by_external_id: {
    type: "object",
    description:
      "The result of the update tool for the item's kind: update_todo (definitions.todo), update_note (definitions.note) or update_schedule_item (definitions.scheduleItem).",
  },
  delete_by_external_id: REF("deleted"),
  create_record: shape(
    { id: "string", created: "boolean" },
    "created is false when external_id replayed an earlier call; id is then that call's record.",
  ),
  list_records: shape(
    { range: "object" },
    "range is { from, to } as sent (null when absent). Without group_by (or 'none'): records (each a definitions.record, newest first) and hasMore. " +
      "With group_by day / week / month: group_by, kind and buckets, each { period, count, sum, avg, min, max, latest }, oldest first; latest is the value of the period's newest record.",
  ),
  delete_record: shape({ success: "boolean", id: "string" }),
  list_extension_apps: shape(
    { apps: "array" },
    "Each app has slug, name, url, icon, description, sort_order, last_record_at (string or null) and records_30d (number).",
  ),
};

/* ---- examples ------------------------------------------------------------ */

export interface ToolExample {
  args: Record<string, unknown>;
}
export interface InvalidExample extends ToolExample {
  reason: string;
}

/**
 * Calls a stand-in must accept and calls it must refuse, kept next to the
 * rules they illustrate. tests/extensionGateway.test.ts runs every one through
 * the real validator and handler, so an example cannot drift from the code.
 */
export const EXAMPLES: Partial<
  Record<ExtensionToolName, { valid: ToolExample[]; invalid: InvalidExample[] }>
> = {
  create_schedule_item: {
    valid: [
      {
        args: {
          date: "2026-10-10",
          title: "Renewal",
          start_time: "09:00",
          end_time: "09:15",
        },
      },
      { args: { date: "2026-10-10", title: "Renewal", is_all_day: true } },
    ],
    invalid: [
      {
        args: { date: "2026-10-10", title: "Renewal" },
        reason: "a timed event without start_time and end_time",
      },
      {
        args: { date: "2026-10-10", title: "Renewal", start_time: "09:00" },
        reason: "end_time is missing too",
      },
      {
        args: { date: "2026-10-10", title: "Renewal", is_all_day: false },
        reason: "is_all_day false is the timed case",
      },
      {
        args: {
          date: "2026-10-10",
          title: "Renewal",
          start_time: "9:00",
          end_time: "09:15",
        },
        reason: "start_time is not zero-padded HH:MM",
      },
      {
        args: { title: "Renewal", is_all_day: true },
        reason: "date is required",
      },
      {
        args: { date: "2026-10-10", title: 7, is_all_day: true },
        reason: "title must be a string",
      },
    ],
  },
  create_todo: {
    valid: [{ args: { title: "Cancel the trial" } }],
    invalid: [
      { args: {}, reason: "title is required" },
      {
        args: { title: "Cancel the trial", status: "in_progress" },
        reason: "status is not one of not_started | done",
      },
    ],
  },
  create_note: {
    valid: [{ args: { title: "Subscriptions", content: "# Plans" } }],
    invalid: [{ args: { content: "# Plans" }, reason: "title is required" }],
  },
  create_record: {
    valid: [
      { args: { kind: "expense", value: 450, unit: "JPY" } },
      {
        args: {
          kind: "expense",
          value: 980,
          unit: "JPY",
          occurred_at: "2026-10-11T12:10:00+09:00",
          dims: { category: "subscription", service: "music" },
        },
      },
    ],
    invalid: [
      { args: { kind: "expense" }, reason: "value is required" },
      {
        args: { kind: "expense", value: "450" },
        reason: "value must be a number",
      },
      {
        args: { kind: "Expense", value: 450 },
        reason:
          "kind is lower-case letters, digits and _, starting with a letter",
      },
      {
        args: {
          kind: "expense",
          value: 450,
          occurred_at: "2026-10-11T12:10:00",
        },
        reason: "occurred_at has no offset",
      },
      {
        args: { kind: "expense", value: 450, dims: { Category: "food" } },
        reason: "a dims key is not lower-case snake_case",
      },
    ],
  },
};

/* ---- the spec ------------------------------------------------------------ */

export interface GatewayToolSpec {
  name: string;
  description: string;
  access: "read" | "write";
  inputSchema: ObjectSchema;
  /** Unconditional `required`, copied from inputSchema for readers of this key alone. */
  required: string[];
  conditionalRequired: ConditionalRequired[];
  stateDependentRules: string[];
  result: ResultShape | { $ref: string };
  examples?: { valid: ToolExample[]; invalid: InvalidExample[] };
}

export interface GatewaySpec {
  specFormat: number;
  gatewayVersion: string;
  /** The life-editor commit this file was generated from (the base, not the commit that adds it). */
  lifeEditorCommit: string;
  conventions: Record<string, unknown>;
  transport: Record<string, unknown>;
  definitions: Record<string, ResultShape>;
  tools: GatewayToolSpec[];
}

const CONVENTIONS = {
  required:
    "inputSchema.required is the unconditional set. A property sent as null counts as not sent; a required one sent as null is an error.",
  conditionalRequired:
    "A tool's conditionalRequired rule says: require[] is also required unless args[unless.field] strictly equals unless.equals. message is the failure text.",
  stateDependentRules:
    "Rules that need stored data to apply. A stand-in must keep state to honour them.",
  undeclaredArguments:
    "An argument the schema does not declare is accepted and ignored; the success result carries a second text item beginning 'Note: <tool> does not accept <names>'. Keys starting with '_' are never reported.",
  result:
    "Result shapes pin top-level keys and their JSON kinds. $ref points into definitions.",
  idempotencyKey:
    "create_todo, create_note and create_schedule_item take an optional idempotency_key (1-200 characters). Same key and same arguments: the first call's item comes back and nothing is created. Same key, different arguments: failure code idempotency_key_reused. Same key whose item was deleted: failure code already_deleted. Keys are per app. Arguments are compared with null counting as absent.",
  records:
    "create_record / list_records / delete_record / list_extension_apps. A record's source_app is the calling app's slug, set from its key; create_record does not take source_app. " +
    "external_id is create_record's retry key, per app: the same external_id with the same content returns the first record with created: false; with different content it fails with code idempotency_key_reused. A deleted record's external_id is free again. " +
    "delete_record deletes only the calling app's records; another source's record fails with code forbidden, a missing one with not_found. list_records and list_extension_apps read every source.",
  externalId:
    "An item made with an idempotency_key can be changed by that key: update_by_external_id({ external_id, changes }) applies changes with the update tool for the item's kind; delete_by_external_id({ external_id }) deletes it (and succeeds again if it is already deleted). Only items the calling app created can be named; any other key is not_found.",
} as const;

const TRANSPORT = {
  protocol:
    "MCP over HTTP: stateless JSON-RPC 2.0, one POST per message, tools/list and tools/call.",
  success:
    "tools/call returns { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }; the parsed text is the tool's result. A second text item may follow (see conventions.undeclaredArguments).",
  failure:
    "A failing call is a normal tools/call result: { content: [{ type: 'text', text: 'Error: <message>' }], isError: true, structuredContent: { code, message } }. The HTTP status stays 200. Branch on structuredContent.code, never on the message.",
  failureCodes: {
    invalid_arguments:
      "The call itself is wrong: a missing or mistyped argument, a malformed date or time, a conditional rule broken.",
    forbidden:
      "The key may not do this: a tool outside its scopes, or an item the app did not create. A request that fails to authenticate at all is not a tool result: it is the HTTP 404 described under authentication.",
    not_found: "No such tool, or no such live item.",
    idempotency_key_reused:
      "The same idempotency_key arrived with different arguments.",
    already_deleted:
      "The idempotency_key belongs to an item that was deleted, so it was not created again.",
    failed:
      "Anything else: a handler's own refusal or a database error. The message says which.",
  } satisfies Record<(typeof ERROR_CODES)[number], string>,
  failureMessages: {
    invalidArguments:
      "Invalid arguments for <tool>: <problem>; <problem> — every problem in one message. Problems read '<path> is required', '<path> must be a <type> (got <type>)', '<path> must be one of a | b (got \"x\")'.",
    unknownTool: "Unknown tool: <name>",
    handler:
      "Anything else is the handler's own text, for example 'Schedule item not found: <id>' or the message of a conditional rule.",
  },
  // Plan R3 / R4, as gatewayWorker.ts and gatewayAuth.ts implement them.
  endpoints: {
    "POST /mcp":
      "JSON-RPC, one message per POST, with the credential in the Authorization header (see authentication). A method other than POST or OPTIONS on /mcp, once the credential authenticates, is HTTP 405 with allow: POST.",
    "POST /exchange":
      "The browser path: a session token for a login (see exchange).",
    "OPTIONS <any path>": "The CORS preflight (see cors).",
    "GET /health": "{ ok: true }, with no credential and no data.",
  },
  authentication:
    "Every request to /mcp carries Authorization: Bearer <credential>, and the header is the only place a credential is read. The credential is either an app key, lek_<8 hex id>_<64 hex secret>, shown once when it is issued (an app may hold several), kept on the app's server side and never put in a page, or a session token, les_<payload>.<signature>, from POST /exchange and good for one hour. A credential in the URL path is never read: /mcp/<anything> is a 404, as is every path other than /mcp, /exchange and /health. OPTIONS is the exception on every path: it is the preflight described under cors. A missing, malformed, wrong, revoked or expired credential, one sent with another scheme than Bearer, a Supabase login JWT, a key whose app was removed and a session whose app stopped allowing the browser or moved to another account all get the same bare HTTP 404 with the body 'Not found'. The response never says which. Such a response is not a JSON-RPC exchange: it has no JSON body and no structuredContent.code.",
  exchange:
    "POST /exchange with Authorization: Bearer <the Supabase login JWT of the account the app is bound to>, an Origin header and the body { \"app\": \"<the app's slug>\" }. It answers HTTP 200 { token: 'les_...', expiresAt: '<ISO instant one hour on>', app: '<slug>' } with cache-control: no-store and Access-Control-Allow-Origin: <that Origin>, when the app allows the browser, the Origin is one of the app's registered origins and the JWT is that account's login. Anything else gets the same bare 404: no Origin, no JWT, another scheme, a method other than POST or OPTIONS (OPTIONS is the preflight under cors), a body that is not JSON, an unknown app, an app without the browser flag, an origin it did not register, another account's login. The token works on POST /mcp until expiresAt; there is no refresh, so ask /exchange again.",
  cors: "An /mcp response carries Access-Control-Allow-Origin: <Origin> and Vary: Origin only when the request authenticated with a session token and its Origin is exactly one of that token's app's registered origins (scheme://host[:port]). This covers the 405 and JSON-RPC errors too. A request with an app key gets no CORS header from any origin, so a page cannot read an answer to a key. OPTIONS on any path answers 204 with no body. From an origin some browser-enabled app registered, it carries Access-Control-Allow-Origin: <Origin>, Access-Control-Allow-Methods: POST, OPTIONS, Access-Control-Allow-Headers: content-type, authorization, mcp-protocol-version, Access-Control-Max-Age: 600 and Vary: Origin. From any other origin, or with no Origin, it carries Vary: Origin alone.",
  scopes:
    "Each app has the scopes read, write or both (the default). A tool's access (tools[].access) has to be among them. tools/list shows only the tools the credential's scopes cover, in the spec's order. A tools/call of a tool outside them is still found: its arguments are validated first (a wrong call is invalid_arguments), and then it fails with code forbidden and the message 'Forbidden: this key has no <access> scope for <tool>'. A write that names an existing item the app did not create (the owner's, life-editor's own, another app's), including create_todo's parent_id, fails with code forbidden and 'Forbidden: <id> was not created by <app>'. An id that names nothing is left to the tool's own not_found.",
  notYetSpecified: [],
} as const;

/**
 * The contract, as the JSON the repository commits.
 *
 * `lifeEditorCommit` is a parameter, not read here: the registry code is pure,
 * and the commit is the generator script's to look up. The freshness test
 * compares everything EXCEPT it, because a file cannot contain the hash of the
 * commit that adds it.
 */
export function buildGatewaySpec(lifeEditorCommit: string): GatewaySpec {
  return {
    specFormat: SPEC_FORMAT,
    gatewayVersion: EXTENSION_GATEWAY_VERSION,
    lifeEditorCommit,
    conventions: CONVENTIONS,
    transport: TRANSPORT,
    definitions: DEFINITIONS,
    tools: EXTENSION_TOOL_DEFINITIONS.map((def) => {
      const name = def.name as ExtensionToolName;
      const examples = EXAMPLES[name];
      return {
        name,
        description: def.description,
        access: EXTENSION_TOOLS[name],
        inputSchema: def.inputSchema,
        required: def.inputSchema.required ?? [],
        conditionalRequired: CONDITIONAL_REQUIRED[name] ?? [],
        stateDependentRules: STATE_DEPENDENT_RULES[name] ?? [],
        result: RESULTS[name],
        ...(examples ? { examples } : {}),
      };
    }),
  };
}

/* ---- what a diff means for the version ----------------------------------- */

export type SpecChange = "none" | "patch" | "minor" | "major";

const RANK: Record<SpecChange, number> = {
  none: 0,
  patch: 1,
  minor: 2,
  major: 3,
};
const higher = (a: SpecChange, b: SpecChange): SpecChange =>
  RANK[a] >= RANK[b] ? a : b;

type PropSchema = { type?: string; enum?: string[] };

function inputChange(
  before: GatewayToolSpec,
  after: GatewayToolSpec,
): SpecChange {
  let level: SpecChange = "none";
  const prev = (before.inputSchema.properties ?? {}) as Record<
    string,
    PropSchema
  >;
  const next = (after.inputSchema.properties ?? {}) as Record<
    string,
    PropSchema
  >;

  for (const [name, was] of Object.entries(prev)) {
    const now = next[name];
    if (!now) return "major";
    if (was.type !== now.type) return "major";
    const wasEnum = was.enum ?? null;
    const nowEnum = now.enum ?? null;
    if (wasEnum && !nowEnum) level = higher(level, "minor");
    else if (!wasEnum && nowEnum) return "major";
    else if (wasEnum && nowEnum) {
      if (wasEnum.some((v) => !nowEnum.includes(v))) return "major";
      if (nowEnum.some((v) => !wasEnum.includes(v)))
        level = higher(level, "minor");
    }
  }
  if (Object.keys(next).some((name) => !(name in prev))) {
    level = higher(level, "minor");
  }

  // Asking for more than before breaks a caller that worked.
  if (after.required.some((name) => !before.required.includes(name)))
    return "major";
  if (before.required.some((name) => !after.required.includes(name))) {
    level = higher(level, "minor");
  }

  const ruleKey = (r: ConditionalRequired) =>
    JSON.stringify([r.require, r.unless]);
  const wasRules = new Set(before.conditionalRequired.map(ruleKey));
  if (after.conditionalRequired.some((r) => !wasRules.has(ruleKey(r))))
    return "major";
  if (before.conditionalRequired.length > after.conditionalRequired.length) {
    level = higher(level, "minor");
  }
  if (after.stateDependentRules.length > before.stateDependentRules.length) {
    return "major";
  }
  if (before.access !== after.access) return "major";
  return level;
}

function resultChange(
  before: GatewayToolSpec,
  after: GatewayToolSpec,
): SpecChange {
  const was = before.result;
  const now = after.result;
  if (JSON.stringify(was) === JSON.stringify(now)) return "none";
  // Pointing at another definition, or swapping a pointer for an inline shape,
  // can drop keys the caller reads; only a key-by-key comparison could tell.
  if ("$ref" in was || "$ref" in now) {
    return "$ref" in was && "$ref" in now && was.$ref === now.$ref
      ? "none"
      : "major";
  }
  if (was.type !== now.type) return "major";
  const kept = new Set(now.required ?? []);
  return (was.required ?? []).some((key) => !kept.has(key)) ? "major" : "minor";
}

/**
 * How big a bump `next` needs over `prev`. Callers read a removal or a
 * tightening as breaking; they only gain from an addition.
 *
 * Result shapes are compared by definition: a key removed from one is a
 * removal for every tool that points at it.
 */
export function classifySpecChange(
  prev: GatewaySpec,
  next: GatewaySpec,
): SpecChange {
  let level: SpecChange = "none";
  const nextByName = new Map(next.tools.map((t) => [t.name, t]));
  const prevByName = new Map(prev.tools.map((t) => [t.name, t]));

  for (const before of prev.tools) {
    const after = nextByName.get(before.name);
    if (!after) return "major";
    level = higher(level, inputChange(before, after));
    level = higher(level, resultChange(before, after));
    if (before.description !== after.description)
      level = higher(level, "patch");
  }
  if (next.tools.some((t) => !prevByName.has(t.name)))
    level = higher(level, "minor");

  for (const [name, was] of Object.entries(prev.definitions)) {
    const now = next.definitions[name];
    if (!now) return "major";
    const nowKeys = new Set(now.required ?? []);
    if ((was.required ?? []).some((key) => !nowKeys.has(key))) return "major";
    if (JSON.stringify(was) !== JSON.stringify(now))
      level = higher(level, "minor");
  }
  if (JSON.stringify(prev.transport) !== JSON.stringify(next.transport)) {
    level = higher(level, "patch");
  }
  return level;
}

/** How far `next` moved from `prev` as a semver, or "downgrade". */
export function versionBump(
  prev: string,
  next: string,
): SpecChange | "downgrade" {
  const parse = (v: string): number[] => v.split(".").map((n) => Number(n));
  const [pa, pb, pc] = parse(prev);
  const [na, nb, nc] = parse(next);
  if (na !== pa) return na > pa ? "major" : "downgrade";
  if (nb !== pb) return nb > pb ? "minor" : "downgrade";
  if (nc !== pc) return nc > pc ? "patch" : "downgrade";
  return "none";
}
