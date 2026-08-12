import type { SupabaseClient } from "@supabase/supabase-js";
import { hashPassword, verifyPassword } from "../utils/passwordHash";
import { fetchMaybeSingleRow, requireSingleRow } from "./postgrestSingle";

/*
 * Shared password gate + edit lock for items_meta-backed domains (#674 / C7).
 *
 * Notes (SupabaseNotesUnifiedLock, G1) and Dailies (SupabaseDailiesUnified-
 * Service, DU-G G2) grew the same six methods line for line: set / remove /
 * verify password, the lazy PBKDF2 rehash, the edit-lock toggle, and the
 * items_meta version bump they all share. The two copies differed only in
 * four values — the role string, the payload table, the error labels, and how
 * the domain object is re-read afterwards — so they are parameters here rather
 * than a second copy of the body.
 *
 * Behaviour is deliberately unchanged: every error string, the order of the
 * round-trips (version SELECT -> items_meta UPDATE -> payload UPDATE ->
 * re-read), and the "verify before clear" rule are preserved verbatim, because
 * both service test suites assert on the message text and on the recorded call
 * shape.
 *
 * password_hash stores a PBKDF2-HMAC-SHA256 derivation (`pbkdf2$v1$...`, see
 * utils/passwordHash.ts), NOT plaintext. Legacy plaintext rows (pre-#118) are
 * still accepted by verify and lazily rehashed into PBKDF2 form on the next
 * successful unlock. RLS still scopes every read to auth.uid()'s rows, and the
 * NOTES / DAILIES payload SELECT lists keep password_hash off the public read
 * path — defence in depth on top of the hash. `has_password` is the generated
 * stored column projected back to the client (true for a hash string just as
 * for plaintext).
 *
 * The three single-row READS below go through `postgrestSingle` like the rest
 * of the layer (#674). The two write paths (`bumpMeta` / `patchPayload`) stay
 * hand-written: an UPDATE without `.select()` returns no row, so there is
 * nothing for those helpers to unwrap.
 */

/**
 * Read current items_meta.version and return version + 1.
 *
 * A missing row throws (caller invariant: the row exists; this only runs from
 * password / lock / restore paths where the caller has already located the
 * item by id). Exported because Dailies also bumps the version from
 * `restoreDailyUnified`, which is outside the lock gate.
 */
export async function nextItemVersion(
  client: SupabaseClient,
  role: string,
  id: string,
  label: string,
): Promise<number> {
  // Row type stays nullable so the `?? 0` fallback keeps covering a null row,
  // not just a null version — the same defensive shape the hand-written read
  // had before it moved onto the shared helper.
  const row = await requireSingleRow<{ version: number | null } | null>(
    client
      .from("items_meta")
      .select("version")
      .eq("id", id)
      .eq("role", role)
      .single(),
    `${label} version read`,
  );
  return (row?.version ?? 0) + 1;
}

/**
 * Method names used verbatim inside the error messages, so each domain keeps
 * reporting its own public method rather than a generic one.
 */
export interface ItemLockGateLabels {
  setPassword: string;
  removePassword: string;
  verifyPassword: string;
  lazyRehash: string;
  toggleEditLock: string;
}

export interface ItemLockGateConfig<TNode> {
  client: SupabaseClient;
  /** items_meta.role this domain owns (`"note"` / `"daily"`). */
  role: string;
  /** The `<role>_payload` table holding password_hash + is_edit_locked. */
  payloadTable: string;
  /**
   * Re-read the domain object after a mutation so the GENERATED
   * `has_password` column and the flipped flags reflect on what we return.
   * Owns its own "row vanished" error text — the two domains word it
   * differently and both are asserted in tests.
   */
  readBack: (id: string, label: string) => Promise<TNode>;
  /**
   * Optional id-shape guard, run before any DB round-trip on the mutating
   * methods (Dailies validates `daily-YYYY-MM-DD`; Notes does not validate).
   * Deliberately NOT applied to verify, matching both originals.
   */
  assertId?: (id: string) => void;
  labels: ItemLockGateLabels;
}

/**
 * The six-method password / edit-lock surface, bound to one domain.
 *
 * Note the DB-Q2 split: the three mutating methods bump
 * `items_meta.updated_at` + `version` so Sync LWW propagates, while the lazy
 * rehash deliberately does NOT (see `lazyRehash` below).
 */
export class ItemLockGate<TNode> {
  constructor(private readonly config: ItemLockGateConfig<TNode>) {}

  /**
   * Bump items_meta.updated_at + version for this item. Reads the current
   * version first (PostgREST cannot express `version = version + 1`).
   */
  private async bumpMeta(id: string, label: string): Promise<void> {
    const { client, role } = this.config;
    const now = new Date().toISOString();
    const nextVersion = await nextItemVersion(client, role, id, label);

    const { error } = await client
      .from("items_meta")
      .update({ updated_at: now, version: nextVersion })
      .eq("id", id)
      .eq("role", role);
    if (error) throw new Error(`${label} meta failed: ${error.message}`);
  }

  /** Patch one column on the payload row, wrapping failures with `label`. */
  private async patchPayload(
    id: string,
    label: string,
    patch: Record<string, unknown>,
  ): Promise<void> {
    const { client, payloadTable } = this.config;
    const { error } = await client
      .from(payloadTable)
      .update(patch)
      .eq("item_id", id);
    if (error) throw new Error(`${label} payload failed: ${error.message}`);
  }

  /**
   * Hash `password` (PBKDF2, Issue #118) and write it into the payload row.
   * The domain object is round-tripped afterwards so the GENERATED
   * `has_password` column reflects on it.
   */
  async setPassword(id: string, password: string): Promise<TNode> {
    const label = this.config.labels.setPassword;
    this.config.assertId?.(id);
    const passwordHash = await hashPassword(password);

    await this.bumpMeta(id, label);
    await this.patchPayload(id, label, { password_hash: passwordHash });
    return this.config.readBack(id, label);
  }

  /**
   * Verify-then-clear. Tauri parity: a wrong currentPassword must NOT mutate
   * the row, so verify is the first step and rejects on mismatch.
   */
  async removePassword(id: string, currentPassword: string): Promise<TNode> {
    const label = this.config.labels.removePassword;
    this.config.assertId?.(id);

    const valid = await this.verifyPassword(id, currentPassword);
    if (!valid) throw new Error("Invalid password");

    await this.bumpMeta(id, label);
    await this.patchPayload(id, label, { password_hash: null });
    return this.config.readBack(id, label);
  }

  /**
   * Verify `password` against the stored PBKDF2 hash (Issue #118). SELECTs
   * password_hash from the payload table (RLS scopes to auth.uid()'s rows).
   * Returns `false` when no hash is set OR the row does not exist
   * (maybeSingle -> null). A legacy plaintext row that matches is lazily
   * rehashed into PBKDF2 form (best-effort — see `lazyRehash`).
   *
   * DEBT status: the plaintext-at-rest debt (old known-issues 027) is
   * RESOLVED. The RPC debt REMAINS — ideally a `security invoker` RPC so the
   * hash never leaves Postgres; today the SELECT list only keeps it off the
   * public read path (defence in depth, not a substitute).
   */
  async verifyPassword(id: string, password: string): Promise<boolean> {
    const { client, payloadTable, labels } = this.config;
    const row = await fetchMaybeSingleRow<{ password_hash: string | null }>(
      client
        .from(payloadTable)
        .select("password_hash")
        .eq("item_id", id)
        .maybeSingle(),
      `${labels.verifyPassword} failed`,
    );
    const stored = row?.password_hash;
    if (stored == null) return false;

    const { ok, needsRehash } = await verifyPassword(password, stored);
    if (ok && needsRehash) await this.lazyRehash(id, password);
    return ok;
  }

  /**
   * Migrate a legacy plaintext password to PBKDF2 form (Issue #118) after a
   * successful verify.
   *
   * DELIBERATE DB-Q2 EXCEPTION — payload-only UPDATE, NO items_meta bump:
   * password_hash sits outside every `*_PAYLOAD_COLUMNS` SELECT shape, so it
   * is absent from the sync surface, and verify always re-reads the single
   * column straight from the cloud row (no client cache). LWW propagation is
   * therefore unnecessary. Bumping updated_at would instead be harmful — the
   * note / daily lists sort by updated_at DESC, so a mere unlock would jump
   * the row to the top. A payload-only write is also atomic (one statement),
   * avoiding the non-atomic meta+payload pair. has_password stays true
   * throughout (plaintext -> hash is still non-null).
   *
   * Best-effort: a write failure is swallowed so it never changes the verify
   * result; the next successful unlock retries the migration.
   */
  private async lazyRehash(id: string, password: string): Promise<void> {
    const label = this.config.labels.lazyRehash;
    try {
      const passwordHash = await hashPassword(password);
      await this.patchPayload(id, label, { password_hash: passwordHash });
    } catch (err) {
      // Swallow (but log): rehash is opportunistic. The verify already
      // succeeded and the plaintext still verifies next time, so a failed
      // migration simply retries on the next unlock. The warn keeps a
      // chronically failing migration observable.
      console.warn(`${label}(${id}) failed:`, err);
    }
  }

  /**
   * Flip `<payload>.is_edit_locked`. Read-modify-write because PostgREST
   * cannot express the SQLite `CASE WHEN ... END` in one statement. Bumps
   * items_meta.updated_at + version so Sync LWW propagates.
   */
  async toggleEditLock(id: string): Promise<TNode> {
    const { client, payloadTable, labels } = this.config;
    const label = labels.toggleEditLock;
    this.config.assertId?.(id);

    const cur = await requireSingleRow<{ is_edit_locked: boolean }>(
      client
        .from(payloadTable)
        .select("is_edit_locked")
        .eq("item_id", id)
        .single(),
      `${label} read failed`,
    );
    const next = !cur.is_edit_locked;

    await this.bumpMeta(id, label);
    await this.patchPayload(id, label, { is_edit_locked: next });
    return this.config.readBack(id, label);
  }
}
