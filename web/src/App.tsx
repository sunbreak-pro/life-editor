import { useEffect, useRef, useState } from "react";
import {
  forgetDomainSnapshots,
  hydrateDomainSnapshots,
  isOffline,
  OFFLINE_READ_TIMEOUT_MS,
  onAuthStateChange,
  readOfflineEntry,
  readSession,
  requestPersistentStorage,
  SESSION_GATE_OFFLINE_MS,
  SESSION_GATE_ONLINE_MS,
  setSessionUnreachable,
  UnsavedGuardProvider,
  useTranslation,
  type Session,
  type SessionRead,
} from "@life-editor/shared";
import { AuthScreen } from "./AuthScreen";
import { MainScreen } from "./MainScreen";
import { AppUpdateBanner } from "./components/AppUpdateBanner";
import { OfflineBanner } from "./components/OfflineBanner";
import { LegalReaderHost } from "./legal/LegalReaderHost";

/*
 * Root: session gate.
 * No session -> AuthScreen. Session -> MainScreen (Todos + Daily over
 * Supabase; section switch is local state per CLAUDE.md §3.2).
 *
 * OFFLINE (#2334). A session that cannot be refreshed reads as null from
 * getSession(), after about 50 seconds (services/offlineSession.ts has the
 * details), and that is not the user being signed out. So the gate waits only
 * SESSION_GATE_*_MS, then looks at what is stored on the device: the stored
 * session plus lists stored for that user open MainScreen with the "view only"
 * band up. A later answer always wins, and SIGNED_OUT ends it for good.
 */

/** While the session cannot be refreshed, ask again this often. */
const SESSION_RETRY_MS = 30_000;

/*
 * The "still owes us a new password" mark (#919), kept in sessionStorage
 * rather than in React state alone. PASSWORD_RECOVERY fires ONCE, while
 * supabase-js is consuming the URL — but the session it just saved outlives
 * any reload. Without a mark that survives with it, pressing F5 on the reset
 * card would drop the user into the app with the password they came here
 * because they cannot remember. Session-scoped on purpose: closing the tab
 * ends the obligation along with the reason to remember it.
 */
const RECOVERY_KEY = "life-editor.pending-password-recovery";

function readRecoveryMark(): boolean {
  // Storage throws in a few privacy configurations; a failure here must not
  // take down the root component.
  try {
    return window.sessionStorage.getItem(RECOVERY_KEY) === "1";
  } catch {
    return false;
  }
}

function writeRecoveryMark(pending: boolean): void {
  try {
    if (pending) window.sessionStorage.setItem(RECOVERY_KEY, "1");
    else window.sessionStorage.removeItem(RECOVERY_KEY);
  } catch {
    // Then the mark simply does not survive a reload — the same behaviour as
    // before it existed, which is degraded but not broken.
  }
}

/*
 * Drop whatever fragment the auth redirect left behind. supabase-js blanks
 * the hash itself after a successful read, but only by assigning to
 * `location.hash` — which leaves a bare "#" on success and leaves the whole
 * `#error=…` fragment when the link had expired (it throws before reaching
 * that line). Note what this does NOT do: assigning to `location.hash` counts
 * as a navigation, so the entry holding the raw tokens is already one step
 * back in history and no in-page call can remove it. Closing that gap for
 * good means the PKCE flow, which is a separate decision (queued).
 */
function stripAuthFragment(): void {
  const { hash, pathname, search } = window.location;
  if (!hash) return;
  window.history.replaceState(window.history.state, "", `${pathname}${search}`);
}

function App() {
  const { t } = useTranslation();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  /*
   * #919: a password-recovery link SIGNS THE USER IN — supabase-js reads the
   * tokens out of the URL (detectSessionInUrl, D-20260816-shared-fix-1) and
   * saves the session before it fires PASSWORD_RECOVERY. So the session gate
   * below is not enough on its own: without this flag the app would swap
   * straight to MainScreen and the user, who came here precisely because they
   * cannot sign in, would never be offered a field to set a new password.
   */
  const [recovering, setRecovering] = useState(readRecoveryMark);
  /*
   * #2331 — the lists stored on this device for the signed-in user, loaded
   * before MainScreen mounts. Every domain reads its first frame from the
   * snapshot store synchronously (useDomainLoad), so the load has to be done
   * by then or the reload draws skeletons as before. It gives up after
   * 300ms (HYDRATE_TIMEOUT_MS), so a slow IndexedDB costs at most that.
   * Offline (#2334) it gets OFFLINE_READ_TIMEOUT_MS: no read follows to cover a
   * miss, and a domain looks up its snapshot only once, so giving up early would
   * leave its list empty until the line is back.
   * A session without a user id (test doubles) skips it.
   */
  const userId = session?.user?.id ?? null;
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  // The user to forget at SIGNED_OUT, when the event's session is already null.
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (userId === null) return;
    lastUserIdRef.current = userId;
    void requestPersistentStorage();
    let active = true;
    void hydrateDomainSnapshots(
      userId,
      isOffline() ? OFFLINE_READ_TIMEOUT_MS : undefined,
    ).then(() => {
      if (active) setHydratedFor(userId);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    let active = true;
    /*
     * Moves at SIGNED_OUT. Work that began before it found a session that no
     * longer exists, so its answer is dropped: this is what stops a read or a
     * look at storage still in flight from bringing a signed-out session back.
     */
    let signOuts = 0;
    let liveSession = false;
    /** MainScreen is open on the stored session, and a look at storage is done. */
    let offlineEntered = false;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const clearRecovery = (): void => {
      setRecovering(false);
      writeRecoveryMark(false);
    };

    const enterOffline = async (): Promise<void> => {
      // A second look could only say less: one slow check must not sign the
      // user out of the screen they are reading.
      if (offlineEntered) return;
      const startedAt = signOuts;
      // The reset card reads no stored data, so a pending reset needs none.
      const entry = await readOfflineEntry(!readRecoveryMark());
      if (!active || startedAt !== signOuts) return;
      setReady(true);
      if (liveSession) return;
      offlineEntered = entry !== null;
      setSessionUnreachable(entry !== null);
      // With no session stored, a recovery mark has nothing behind it either.
      if (entry === null) {
        clearRecovery();
        // The check may only have run out of time, so it gets another turn.
        scheduleRetry();
      }
      setSession(entry);
    };

    const scheduleRetry = (): void => {
      if (retry !== null) clearTimeout(retry);
      retry = setTimeout(() => void ask(), SESSION_RETRY_MS);
    };

    const applyRead = (read: SessionRead): void => {
      if (read.unreachable) {
        void enterOffline();
        scheduleRetry();
        return;
      }
      liveSession = read.session !== null;
      offlineEntered = false;
      setSessionUnreachable(false);
      if (!read.session) clearRecovery();
      setSession(read.session);
      setReady(true);
    };

    /** Offline there is nothing to ask: `online` below starts the next try. */
    let asking = false;
    const ask = async (): Promise<void> => {
      if (navigator.onLine === false) {
        // Storage does not need the first read to finish, which can take 50s.
        if (signOuts === 0 && !liveSession) void enterOffline();
        scheduleRetry();
        return;
      }
      if (asking) return;
      asking = true;
      const startedAt = signOuts;
      const read = await readSession();
      asking = false;
      if (active && startedAt === signOuts) applyRead(read);
    };

    /*
     * The first read gets a time limit and a recovery link still works past it:
     * only the answer strips the URL, because supabase-js has finished reading
     * it by then, and PASSWORD_RECOVERY reaches the listener below at any time.
     */
    const gate = setTimeout(
      () => void enterOffline(),
      isOffline() ? SESSION_GATE_OFFLINE_MS : SESSION_GATE_ONLINE_MS,
    );
    asking = true;
    void readSession().then((read) => {
      asking = false;
      clearTimeout(gate);
      if (!active) return;
      stripAuthFragment();
      if (signOuts === 0) applyRead(read);
      else setReady(true);
    });

    const onOnline = (): void => {
      if (!liveSession) void ask();
    };
    window.addEventListener("online", onOnline);

    const sub = onAuthStateChange((event, s) => {
      // supabase-js also sends this with null when the refresh could not reach
      // the network, so only the read above can say what a null here means.
      if (event === "INITIAL_SESSION" && !s) return;
      setSession(s);
      if (s) {
        liveSession = true;
        offlineEntered = false;
        setSessionUnreachable(false);
      }
      if (event === "PASSWORD_RECOVERY") {
        setRecovering(true);
        writeRecoveryMark(true);
      }
      // Signing out clears the flag too, so a stale recovery state cannot
      // strand the next sign-in on the reset card.
      if (event === "SIGNED_OUT") {
        signOuts += 1;
        liveSession = false;
        offlineEntered = false;
        setSessionUnreachable(false);
        clearRecovery();
        // #2331: a sign-out from anywhere (another tab, an expired refresh
        // token, account deletion) leaves no lists of this user on the device.
        const previous = lastUserIdRef.current;
        lastUserIdRef.current = null;
        if (previous !== null) void forgetDomainSnapshots(previous);
      }
    });
    return () => {
      active = false;
      clearTimeout(gate);
      if (retry !== null) clearTimeout(retry);
      window.removeEventListener("online", onOnline);
      setSessionUnreachable(false);
      sub.unsubscribe();
    };
  }, []);

  // OfflineBanner sits above every state (loading / auth / main) because
  // connectivity matters before sign-in too — an offline `getSession()`
  // may never resolve, so the warning must be reachable on the loading
  // screen as well.
  let body: React.JSX.Element;
  const hydrated = userId === null || hydratedFor === userId;
  if (!ready || (session && !recovering && !hydrated)) {
    body = (
      <div className="h-full bg-lumen-bg text-lumen-text flex items-center justify-center">
        <p className="text-lumen-text-secondary">Loading…</p>
      </div>
    );
  } else if (recovering && session) {
    body = (
      <AuthScreen
        recovery
        // The recovery link already signed the user in, so the address is
        // known here even though the reset card never asked for it (#945).
        recoveryUsername={session.user.email}
        onRecoveryComplete={() => {
          setRecovering(false);
          writeRecoveryMark(false);
        }}
      />
    );
  } else {
    body = session ? <MainScreen session={session} /> : <AuthScreen />;
  }

  /*
   * UnsavedGuardProvider (#753) is mounted HERE rather than inside MainScreen,
   * and the placement is the whole point: the two containers that ask through
   * it are MainScreen's own section switch (a hook called in MainScreen's body,
   * which sits OUTSIDE every Provider MainScreen renders — the #548 trap) and
   * RightSidebarProvider, which MainScreen renders. One level up is the only
   * place both can see it.
   *
   * Copy is injected already translated (§6.4) — the shared Provider owns the
   * dialog but never calls useTranslation itself.
   */
  return (
    <UnsavedGuardProvider
      labels={{
        message: t("common.unsavedCloseConfirm"),
        discard: t("common.discard"),
        cancel: t("common.cancel"),
      }}
    >
      {/*
       * #2622: the banners and the body share one frame of the screen's
       * height. The banners keep their own height; the body takes the rest
       * (`min-h-0 flex-1`), which AppShell fills (`h-full`, or the token capped
       * by `max-h-full` on the narrow shell). Stacked as
       * plain siblings, a banner pushed a 100vh shell a banner's height past
       * the bottom of the screen and cut off its last row (the bottom tab bar
       * on a phone).
       *
       * The height is --app-shell-height rather than `h-dvh`: it is the token
       * the narrow shell already used and `body { min-height }` reads
       * (web/src/index.css, #631), and it carries the iOS home-screen
       * correction (#1037) that a bare viewport unit would lose.
       *
       * `overflow-y-auto` is for AuthScreen, which sizes itself to the whole
       * screen (`min-h-svh`): under a banner it scrolls inside the body
       * instead of pushing the page. The shell fits exactly and never scrolls
       * here.
       */}
      <div className="flex h-[var(--app-shell-height)] flex-col">
        {/* The cap is for the failed-send band, which prints the unsent
            Todos' text in full: a few of them on a phone would otherwise
            squeeze the body to nothing. One-line bands never reach it. */}
        <div className="max-h-[40%] shrink-0 overflow-y-auto">
          <OfflineBanner />
          <AppUpdateBanner />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
      </div>
      {/*
       * #1251: the policy and the terms, mounted ABOVE the session gate.
       * Living inside AuthScreen meant they vanished the moment you signed
       * in, and a `?legal=` link was swallowed by the gate — terms you can
       * only read while signed out are terms you cannot check when you
       * finally have a reason to. It overlays `body` rather than replacing
       * it, so reading mid-sentence costs neither the section you were in
       * nor the note you were typing.
       */}
      <LegalReaderHost />
    </UnsavedGuardProvider>
  );
}

export default App;
