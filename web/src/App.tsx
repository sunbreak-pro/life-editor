import { useEffect, useState } from "react";
import {
  getSession,
  onAuthStateChange,
  UnsavedGuardProvider,
  useTranslation,
  type Session,
} from "@life-editor/shared";
import { AuthScreen } from "./AuthScreen";
import { MainScreen } from "./MainScreen";
import { OfflineBanner } from "./components/OfflineBanner";

/*
 * Root: session gate.
 * No session -> AuthScreen. Session -> MainScreen (Todos + Daily over
 * Supabase; section switch is local state per CLAUDE.md §3.2).
 */

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

  useEffect(() => {
    let active = true;
    void getSession().then((s) => {
      if (!active) return;
      // supabase-js has finished reading the URL by the time this resolves.
      stripAuthFragment();
      // A mark with no session behind it can only strand the user on a reset
      // card that cannot submit, so it dies with the session.
      if (!s) {
        setRecovering(false);
        writeRecoveryMark(false);
      }
      setSession(s);
      setReady(true);
    });
    const sub = onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") {
        setRecovering(true);
        writeRecoveryMark(true);
      }
      // Signing out clears the flag too, so a stale recovery state cannot
      // strand the next sign-in on the reset card.
      if (event === "SIGNED_OUT") {
        setRecovering(false);
        writeRecoveryMark(false);
      }
    });
    return () => {
      active = false;
      sub.unsubscribe();
    };
  }, []);

  // OfflineBanner sits above every state (loading / auth / main) because
  // connectivity matters before sign-in too — an offline `getSession()`
  // may never resolve, so the warning must be reachable on the loading
  // screen as well.
  let body: React.JSX.Element;
  if (!ready) {
    body = (
      <div className="min-h-screen bg-lumen-bg text-lumen-text flex items-center justify-center">
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
      <OfflineBanner />
      {body}
    </UnsavedGuardProvider>
  );
}

export default App;
