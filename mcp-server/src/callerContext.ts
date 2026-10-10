import { AsyncLocalStorage } from "node:async_hooks";

/*
 * Who is calling the gateway, carried to the places that need to know without
 * threading a parameter through every handler (#2146).
 *
 * The handlers are shared with the phone's Worker and the stdio server, and
 * none of them takes a caller. Two things still depend on who it is: which
 * Supabase account `getSupabase()` signs in as (R8 — the review account's items
 * must not land in the owner's data), and which app `insertItem` stamps as an
 * item's origin (R6). Both read it from here, so a call that was never routed
 * through the gateway — stdio, the phone's Worker — sees no caller and behaves
 * exactly as it did before this file existed.
 *
 * AsyncLocalStorage rather than a module variable because a Worker isolate
 * serves overlapping requests: a variable set for one request would be read by
 * the next one awaiting alongside it, which for the account is the difference
 * between the review data and the owner's.
 */

export type GatewayAccount = "owner" | "review";
export type GatewayScope = "read" | "write";

export interface Caller {
  /** The registered app name; it is also what `items_meta.origin_app` holds. */
  app: string;
  /** Which Supabase account this app's items live in. */
  account: GatewayAccount;
  scopes: readonly GatewayScope[];
}

const storage = new AsyncLocalStorage<Caller>();

/** Run `fn` — and everything it awaits — as `caller`. */
export function runAs<T>(caller: Caller, fn: () => T): T {
  return storage.run(caller, fn);
}

/** The gateway caller of this call chain, or undefined outside the gateway. */
export function currentCaller(): Caller | undefined {
  return storage.getStore();
}
