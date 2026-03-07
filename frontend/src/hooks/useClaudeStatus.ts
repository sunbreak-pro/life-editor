import { useState, useEffect } from "react";

export type ClaudeState =
  | "inactive"
  | "idle"
  | "thinking"
  | "generating"
  | "tool_use"
  | "error";

export function useClaudeStatus(): ClaudeState {
  const [state, setState] = useState<ClaudeState>("inactive");

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onClaudeStatus) return;

    const unsubscribe = api.onClaudeStatus((_sessionId, newState) => {
      setState(newState as ClaudeState);
    });

    return unsubscribe;
  }, []);

  return state;
}
