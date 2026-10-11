/*
 * Machine-readable failure codes for tool calls (#2148, plan R7).
 *
 * A failing call has always been `{ content: [{ text: "Error: <message>" }],
 * isError: true }`. That is enough for a person, and not for the unattended
 * loop that builds an extension app: it cannot tell "I sent the wrong
 * arguments" from "that item is not there" without parsing English. The code is
 * the part a program may branch on. The message stays what it was, word for
 * word, so nothing that reads the text is disturbed.
 *
 * THE SET IS SMALL ON PURPOSE. Each code is a promise to another repository, so
 * a new one is a gateway version bump.
 *
 *   invalid_arguments       the call itself is wrong: a missing or mistyped
 *                           argument, a malformed date or time, a conditional
 *                           rule (is_all_day) broken.
 *   forbidden               the key is known but may not do this: a tool outside
 *                           its scopes, an item another app (or the owner) made.
 *                           An HTTP-level failure to authenticate at all is not
 *                           a tool result: it is the Worker's bare 404.
 *   not_found               no such tool, or no such live item.
 *   idempotency_key_reused  the same idempotency_key arrived with different
 *                           content (D-20261007-main-6 = A).
 *   already_deleted         the key belongs to an item that was since deleted,
 *                           so it was not created again (same decision).
 *   failed                  anything else — a handler's own refusal, a database
 *                           error. The message says which.
 */

export const ERROR_CODES = [
  "invalid_arguments",
  "forbidden",
  "not_found",
  "idempotency_key_reused",
  "already_deleted",
  "failed",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** An Error that names its code. The message is the human-readable text. */
export class CodedError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "CodedError";
    this.code = code;
  }
}

/** "<label> not found: <id>" — the one spelling every handler shares. */
export function notFoundError(message: string): CodedError {
  return new CodedError("not_found", message);
}

export function invalidArguments(message: string): CodedError {
  return new CodedError("invalid_arguments", message);
}

export function codeOf(error: unknown): ErrorCode {
  return error instanceof CodedError ? error.code : "failed";
}

/**
 * The tools/call result for a failure: the text a person reads, `isError`, and
 * the code in `structuredContent` for a program. Both Workers and the stdio
 * server answer with it, so the fields cannot differ between doors.
 */
export function errorResult(error: unknown): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
  structuredContent: { code: ErrorCode; message: string };
} {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
    structuredContent: { code: codeOf(error), message },
  };
}
