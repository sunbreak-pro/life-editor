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
 * No session -> AuthScreen. Session -> MainScreen (Tasks + Daily over
 * Supabase; section switch is local state per CLAUDE.md §3.2).
 */
function App() {
  const { t } = useTranslation();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void getSession().then((s) => {
      if (!active) return;
      setSession(s);
      setReady(true);
    });
    const sub = onAuthStateChange((_event, s) => {
      setSession(s);
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
