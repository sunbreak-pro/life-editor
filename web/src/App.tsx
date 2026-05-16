import { useEffect, useState } from "react";
import {
  getSession,
  onAuthStateChange,
  type Session,
} from "@life-editor/shared";
import { AuthScreen } from "./AuthScreen";
import { TasksScreen } from "./TasksScreen";

/*
 * Phase 1 root: session gate.
 * No session -> AuthScreen. Session -> TasksScreen (Supabase CRUD).
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

  return session ? <TasksScreen session={session} /> : <AuthScreen />;
}

export default App;
