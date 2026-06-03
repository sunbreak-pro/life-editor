import { useEffect, useState } from "react";
import {
  getSession,
  onAuthStateChange,
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
      <div className="min-h-screen bg-notion-bg text-notion-text flex items-center justify-center">
        <p className="text-notion-text-secondary">Loading…</p>
      </div>
    );
  } else {
    body = session ? <MainScreen session={session} /> : <AuthScreen />;
  }

  return (
    <>
      <OfflineBanner />
      {body}
    </>
  );
}

export default App;
