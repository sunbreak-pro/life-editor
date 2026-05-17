import { useEffect, useState } from "react";
import {
  getSession,
  onAuthStateChange,
  type Session,
} from "@life-editor/shared";
import { AuthScreen } from "./AuthScreen";
import { MainScreen } from "./MainScreen";

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

  if (!ready) {
    return (
      <div className="min-h-screen bg-notion-bg text-notion-text flex items-center justify-center">
        <p className="text-notion-text-secondary">Loading…</p>
      </div>
    );
  }

  return session ? <MainScreen session={session} /> : <AuthScreen />;
}

export default App;
