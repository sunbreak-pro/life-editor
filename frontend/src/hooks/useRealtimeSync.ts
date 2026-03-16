import { useEffect, useRef, useState, useCallback } from "react";
import { getApiBaseUrl, getApiToken } from "../config/api";

export type ConnectionState = "connecting" | "connected" | "disconnected";

export interface ChangeEvent {
  entity: string;
  action: "create" | "update" | "delete" | "bulk";
  id?: string | number;
  timestamp: number;
}

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

export function useRealtimeSync(
  onChange: (event: ChangeEvent) => void,
): ConnectionState {
  const [state, setState] = useState<ConnectionState>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const connect = useCallback(() => {
    const baseUrl = getApiBaseUrl();
    const token = getApiToken();
    if (!baseUrl || !token) return;

    const wsUrl = baseUrl.replace(/^http/, "ws") + `/ws?token=${token}`;

    setState("connecting");

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setState("connected");
      retriesRef.current = 0;
    };

    ws.onmessage = (ev) => {
      try {
        const event: ChangeEvent = JSON.parse(ev.data);
        onChangeRef.current(event);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setState("disconnected");
      wsRef.current = null;
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  const scheduleReconnect = useCallback(() => {
    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, retriesRef.current),
      RECONNECT_MAX_MS,
    );
    retriesRef.current++;
    timerRef.current = setTimeout(connect, delay);
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  return state;
}
