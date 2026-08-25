// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect, vi } from "vitest";

/*
 * Runtime half of the #671 C4 lockstep guard.
 *
 * The type half lives in `src/services/dataServiceRouting.ts` (it has to —
 * `shared/tsconfig.json` only includes `src`, so a type assertion parked
 * here would never be checked and would guard nothing). What types cannot
 * see is checked here:
 *
 *   - two domains claiming the same method name. `route()` returns the
 *     first match, so the loser is silently shadowed and its class is
 *     never called.
 *   - a name that type-checks against the interface but is not actually a
 *     method on the class that claims it.
 *   - a domain whose set was never added to `route()`'s if-chain — its
 *     methods would fall through to the "not implemented in phase 2"
 *     thrower even though everything type-checks.
 *   - the fallback itself still throwing for an unknown property.
 */

vi.mock("../src/services/supabaseClient", () => ({
  // The routing checks never issue a query; the Proxy only needs SOME
  // client object to hand to the domain constructors.
  getSupabaseClient: () => ({ from: () => ({}) }),
}));

import {
  PHASE2_ROUTING_DOMAINS,
  ROUTED_METHOD_NAMES,
} from "../src/services/dataServiceRouting";
import { createSupabaseDataService } from "../src/services/SupabaseDataService";

describe("DataService routing table", () => {
  it("claims every method name exactly once across domains", () => {
    const owners = new Map<string, string[]>();
    for (const { domain, names } of PHASE2_ROUTING_DOMAINS) {
      for (const name of names) {
        owners.set(name, [...(owners.get(name) ?? []), domain]);
      }
    }
    const shadowed = [...owners.entries()]
      .filter(([, domains]) => domains.length > 1)
      .map(([name, domains]) => `${name} -> ${domains.join(", ")}`);
    expect(shadowed).toEqual([]);
    expect(owners.size).toBe(ROUTED_METHOD_NAMES.length);
  });

  it("keeps each domain's Set in step with its name tuple", () => {
    for (const { domain, names, methods } of PHASE2_ROUTING_DOMAINS) {
      const missing = names.filter((name) => !methods.has(name));
      expect(missing, `${domain}: names not in Set`).toEqual([]);
      expect(methods.size, `${domain}: Set size`).toBe(new Set(names).size);
    }
  });

  it("resolves every routed name to a method on its owner class", () => {
    for (const { domain, names, service } of PHASE2_ROUTING_DOMAINS) {
      // Reflect.get rather than an index cast: `service` is a union of 12
      // class constructors, and `prototype as Record<string, unknown>` is
      // the kind of overlap tsc rejects once the suites are type-checked
      // (tsconfig.test.json). It is also literally what the Proxy does.
      const proto: object = service.prototype;
      const unresolved = names.filter(
        (name) => typeof Reflect.get(proto, name) !== "function",
      );
      expect(
        unresolved,
        `${domain}: not implemented on ${service.name}`,
      ).toEqual([]);
    }
  });

  it("binds every routed name through the Proxy (no domain left unwired)", () => {
    const ds = createSupabaseDataService() as unknown as Record<
      string,
      (...args: unknown[]) => unknown
    >;
    // route() binds the real method to its owning instance, so the
    // returned function is named "bound <method>". The fallback thrower is
    // an anonymous arrow, whose name is the empty string — which makes the
    // name the cheapest way to tell "routed" from "fell through" without
    // issuing a single query.
    const fellThrough = ROUTED_METHOD_NAMES.filter(
      (name) => ds[name]?.name !== `bound ${name}`,
    );
    expect(fellThrough).toEqual([]);
  });

  it("still throws for a property no domain owns", () => {
    const ds = createSupabaseDataService() as unknown as Record<
      string,
      (...args: unknown[]) => unknown
    >;
    expect(() => ds.thisMethodDoesNotExist()).toThrow(
      "thisMethodDoesNotExist: not implemented in phase 2",
    );
  });
});
