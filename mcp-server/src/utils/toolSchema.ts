/*
 * Runtime validation of tool arguments against the JSON Schema each tool
 * publishes (#669 / core-refactor C2).
 *
 * Until this landed, `callTool` cast the raw arguments straight to the
 * handler's parameter type (`args as Parameters<typeof handler>[0]`). A cast
 * is a promise to the compiler, not a check: a missing `id` or a number where
 * a string belongs reached the handler untouched and surfaced later as a
 * confusing Supabase error — or, worse, as a write built from `undefined`.
 *
 * The schemas in `tools.ts` are already the contract Claude Code reads at
 * connect time, so they are also the right thing to enforce. This validator
 * covers exactly the JSON Schema subset those schemas use — object /
 * string / number / boolean / array, `enum`, `required`, and nesting — and
 * nothing more. Anything it cannot express stays unchecked rather than
 * silently rejected.
 *
 * Two deliberate leniencies keep it from being stricter than the wire:
 *   - undeclared properties pass. No schema here sets
 *     `additionalProperties: false`, so rejecting extras would break a
 *     caller that sends a superset of what it needs.
 *   - an explicit `null` on an OPTIONAL property is treated as "not
 *     supplied". Handlers already normalise with `?? null` / `!== undefined`,
 *     and rejecting it would fail calls that used to succeed. A `null` on a
 *     REQUIRED property is still an error — that one is never intentional.
 */

export type StringSchema = {
  type: "string";
  enum?: string[];
  description?: string;
};

export type NumberSchema = {
  type: "number";
  description?: string;
};

export type BooleanSchema = {
  type: "boolean";
  description?: string;
};

export type ArraySchema = {
  type: "array";
  /** Omitted = element shape is unconstrained (see `format_content`). */
  items?: JsonSchema;
  description?: string;
};

/**
 * Declared as a type alias rather than an interface on purpose: the MCP SDK's
 * `Tool["inputSchema"]` carries an index signature, and only object *types*
 * get the implicit index signature that makes them assignable to it.
 */
export type ObjectSchema = {
  type: "object";
  /** Omitted = any object is accepted (see `format_content`'s `block`). */
  properties?: Record<string, JsonSchema>;
  required?: string[];
  description?: string;
};

export type JsonSchema =
  StringSchema | NumberSchema | BooleanSchema | ArraySchema | ObjectSchema;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `"string"` / `"number"` / … / `"array"` / `"null"` — for error text. */
function describeType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function checkValue(
  schema: JsonSchema,
  value: unknown,
  path: string,
  problems: string[],
): void {
  switch (schema.type) {
    case "string":
      if (typeof value !== "string") {
        problems.push(`${path} must be a string (got ${describeType(value)})`);
        return;
      }
      if (schema.enum && !schema.enum.includes(value)) {
        problems.push(
          `${path} must be one of ${schema.enum.join(" | ")} (got ${JSON.stringify(value)})`,
        );
      }
      return;

    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        problems.push(`${path} must be a number (got ${describeType(value)})`);
      }
      return;

    case "boolean":
      if (typeof value !== "boolean") {
        problems.push(`${path} must be a boolean (got ${describeType(value)})`);
      }
      return;

    case "array": {
      if (!Array.isArray(value)) {
        problems.push(`${path} must be an array (got ${describeType(value)})`);
        return;
      }
      const items = schema.items;
      if (!items) return;
      value.forEach((element, i) =>
        checkValue(items, element, `${path}[${i}]`, problems),
      );
      return;
    }

    case "object":
      checkObject(schema, value, path, problems);
      return;
  }
}

function checkObject(
  schema: ObjectSchema,
  value: unknown,
  path: string,
  problems: string[],
): void {
  if (!isPlainObject(value)) {
    problems.push(`${path} must be an object (got ${describeType(value)})`);
    return;
  }

  for (const name of schema.required ?? []) {
    const supplied = value[name];
    if (supplied === undefined || supplied === null) {
      problems.push(`${path ? `${path}.` : ""}${name} is required`);
    }
  }

  for (const [name, propertySchema] of Object.entries(
    schema.properties ?? {},
  )) {
    const supplied = value[name];
    // `null` on an optional property means "not supplied" (see header).
    if (supplied === undefined || supplied === null) continue;
    checkValue(
      propertySchema,
      supplied,
      path ? `${path}.${name}` : name,
      problems,
    );
  }
}

/**
 * Throw unless `args` satisfies `schema`. Every problem found is reported in
 * one message — a caller that got two arguments wrong should learn both at
 * once instead of fixing them one round-trip at a time.
 */
export function validateToolArgs(
  toolName: string,
  schema: ObjectSchema,
  args: unknown,
): void {
  const problems: string[] = [];
  checkObject(schema, args, "", problems);
  if (problems.length > 0) {
    throw new Error(
      `Invalid arguments for ${toolName}: ${problems.join("; ")}`,
    );
  }
}
