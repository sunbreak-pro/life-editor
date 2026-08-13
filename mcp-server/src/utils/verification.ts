import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ItemRole } from "./items.js";

/*
 * The verification harness's two safety rails (#700 Step 2).
 *
 * WHERE THE DATA GOES — D-20260812-shared-fix-3 picked option A: a dedicated
 * verification account, separated from the owner's real data by the RLS
 * policies every table already carries (`auth.uid() = user_id`, with
 * `user_id` defaulted server-side — see supabase/migrations/0002_rls_todos.sql).
 * The MCP server signs in as an ordinary authenticated user with the anon key
 * (supabase.ts), never service_role, so it cannot read or write another
 * account's rows even if a tool here is buggy. Switching accounts is an env
 * change, not a code change.
 *
 * That mechanism only holds if the env actually points at the verification
 * account, and nothing in a password can tell us which account it is. So the
 * seeding tools refuse to run unless the operator has said out loud that this
 * process is the verification one:
 *
 *   LIFE_EDITOR_VERIFICATION_MODE=1
 *
 * Recommended shape: a SECOND `.mcp.json` server entry (e.g. "life-editor-verify")
 * running the same binary, whose `env` block maps the verification account's
 * credentials onto LIFE_EDITOR_SUPABASE_EMAIL / _PASSWORD and sets the flag.
 * The everyday entry then cannot reach these tools at all. Credentials stay
 * `${VAR}` references — never expanded in a committed file (CLAUDE.md §9).
 *
 * WHAT WAS SEEDED — the ledger below. Cleanup must not mean "delete
 * everything the account can see", and it must not depend on the operator
 * remembering ids: the tool writes down every row it creates and reads that
 * back when asked to clean up. Ledger entries survive a server restart
 * (a plain JSON file), because the failure this guards against is exactly the
 * one that already happened once — verification data left behind for a human
 * to find later.
 */

const TRUTHY = new Set(["1", "true", "yes", "on"]);

/** Is this process the designated verification one? */
export function verificationModeEnabled(): boolean {
  const raw = process.env.LIFE_EDITOR_VERIFICATION_MODE ?? "";
  return TRUTHY.has(raw.trim().toLowerCase());
}

/**
 * Refuse to run outside verification mode. The message names the fix, since
 * the caller is an LLM that cannot see the server's environment.
 */
export function assertVerificationMode(tool: string): void {
  if (verificationModeEnabled()) return;
  throw new Error(
    `${tool} is disabled: this MCP server is not in verification mode. ` +
      "It writes and deletes rows, so it only runs against the dedicated " +
      "verification account (D-20260812-shared-fix-3). Point the server's " +
      "LIFE_EDITOR_SUPABASE_EMAIL / _PASSWORD at that account and set " +
      "LIFE_EDITOR_VERIFICATION_MODE=1 — ideally as a separate .mcp.json " +
      "entry, so the everyday connection can never reach these tools.",
  );
}

export interface SeededItem {
  id: string;
  role: ItemRole;
  /** The `<role>_payload` table holding this item's second row. */
  payloadTable: string;
  title: string;
}

export interface SeedRun {
  runId: string;
  label: string | null;
  /** The local day the fixture was placed on (YYYY-MM-DD). */
  date: string;
  createdAt: string;
  items: SeededItem[];
}

export interface Ledger {
  version: 1;
  runs: SeedRun[];
}

const EMPTY_LEDGER: Ledger = { version: 1, runs: [] };

/**
 * Where the ledger lives. Defaults to the package root — NOT a temp
 * directory, which would be swept between reboots and strand the rows it
 * describes. `LIFE_EDITOR_VERIFICATION_LEDGER` overrides it (tests do).
 */
export function ledgerPath(): string {
  const override = process.env.LIFE_EDITOR_VERIFICATION_LEDGER;
  if (override && override.trim() !== "") return resolve(override.trim());
  // dist/utils/verification.js and src/utils/verification.ts are both two
  // levels below the package root, so this resolves the same either way.
  return resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    ".verification-ledger.json",
  );
}

export function readLedger(): Ledger {
  const path = ledgerPath();
  if (!existsSync(path)) return { ...EMPTY_LEDGER, runs: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    // A ledger we cannot read is worse than none: it means rows exist that
    // cleanup no longer knows about. Say so instead of starting fresh.
    throw new Error(
      `Verification ledger at ${path} is unreadable (${
        err instanceof Error ? err.message : String(err)
      }). Fix or remove it by hand — rows it listed are still in the DB.`,
    );
  }

  const runs = (parsed as Partial<Ledger> | null)?.runs;
  if (!Array.isArray(runs)) return { ...EMPTY_LEDGER, runs: [] };
  return { version: 1, runs: runs as SeedRun[] };
}

export function writeLedger(ledger: Ledger): void {
  const path = ledgerPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
}

/**
 * Record a run. Written BEFORE the tool answers, so a crash between the
 * writes and the reply still leaves cleanup able to find the rows.
 */
export function recordRun(run: SeedRun): void {
  const ledger = readLedger();
  ledger.runs.push(run);
  writeLedger(ledger);
}

/**
 * Drop the given ids from a run, and the run itself once it is empty. Ids
 * whose delete FAILED are left in place on purpose — the ledger is the list
 * of rows still out there, so a partial cleanup can simply be re-run.
 */
export function forgetItems(runId: string, deletedIds: string[]): void {
  if (deletedIds.length === 0) return;
  const gone = new Set(deletedIds);
  const ledger = readLedger();
  ledger.runs = ledger.runs
    .map((run) =>
      run.runId === runId
        ? { ...run, items: run.items.filter((item) => !gone.has(item.id)) }
        : run,
    )
    .filter((run) => run.items.length > 0);
  writeLedger(ledger);
}
