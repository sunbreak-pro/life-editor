import { createElement, useEffect, useState, type ReactNode } from "react";
import { SyncContext } from "../../src/context/SyncContextValue";
import {
  SYNC_DOMAINS,
  uniformDomainVersions,
  type SyncDomain,
} from "../../src/context/syncDomains";

/*
 * A Sync Provider a test can bump (#672 PR-A).
 *
 * Every suite that exercises a refetch-on-Realtime path needs the same three
 * things: a SyncContext stub, a way to move a counter from outside React, and
 * the discipline of publishing that setter from an EFFECT rather than during
 * render (shared lint #421 rejects both reassigning an outer binding —
 * react-hooks/globals — and mutating an outer value mid-render —
 * react-hooks/immutability). Two suites had hand-written copies of it before
 * this helper existed; the hooks added in #672 would have made three.
 *
 * `bump(domain)` moves ONE domain and leaves the app-wide `syncVersion`
 * frozen: a hook still reading the global counter instead of its own domain
 * then never refetches, which is the whole point of syncDomainWiring's
 * assertions. `bump()` with no argument moves every domain and the app-wide
 * counter together — the "something changed somewhere" shape the older suites
 * use.
 *
 * Every test must await the initial load before bumping, so the publishing
 * effect has always run by then.
 */

export interface BumpableSyncHandle {
  /** Move one domain's counter, or every counter when called with none. */
  bump: (domain?: SyncDomain) => void;
}

export interface BumpableSync {
  /** Shared holder — read `sync.bump` at call time, never destructure early. */
  sync: BumpableSyncHandle;
  /** Pass straight to `renderHook(..., { wrapper })`. */
  wrapper: ({
    children,
  }: {
    children: ReactNode;
  }) => ReturnType<typeof createElement>;
}

export function createBumpableSync(): BumpableSync {
  const sync: BumpableSyncHandle = { bump: () => {} };

  function BumpableSyncProvider({ children }: { children: ReactNode }) {
    const [versions, setVersions] = useState(() => uniformDomainVersions(0));
    const [appVersion, setAppVersion] = useState(0);
    useEffect(() => {
      sync.bump = (domain) => {
        if (domain === undefined) {
          setVersions((prev) =>
            SYNC_DOMAINS.reduce(
              (next, d) => ({ ...next, [d]: prev[d] + 1 }),
              {} as Record<SyncDomain, number>,
            ),
          );
          setAppVersion((v) => v + 1);
          return;
        }
        setVersions((prev) => ({ ...prev, [domain]: prev[domain] + 1 }));
      };
    }, []);

    return createElement(
      SyncContext.Provider,
      {
        value: {
          syncVersion: appVersion,
          domainVersions: versions,
          triggerSync: async () => {},
        },
      },
      children,
    );
  }

  return { sync, wrapper: BumpableSyncProvider };
}
