import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../context/ToastContext";

export interface ServiceErrorHandlerOptions {
  silent?: boolean;
  rateLimitMs?: number;
}

export interface ServiceErrorHandler {
  handle: (
    err: unknown,
    i18nKey: string,
    opts?: ServiceErrorHandlerOptions,
  ) => void;
}

const DEFAULT_RATE_LIMIT_MS = 5000;

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "Unknown error";
  }
}

export function useServiceErrorHandler(): ServiceErrorHandler {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const lastShownRef = useRef<Map<string, number>>(new Map());

  const tRef = useRef(t);
  const showToastRef = useRef(showToast);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  const handle = useCallback(
    (
      err: unknown,
      i18nKey: string,
      opts: ServiceErrorHandlerOptions = {},
    ): void => {
      const { silent = false, rateLimitMs = DEFAULT_RATE_LIMIT_MS } = opts;
      const errorMessage = toErrorMessage(err);

      if (import.meta.env.DEV) {
        console.error(`[${i18nKey}]`, err);
      }

      if (silent) return;

      const now = Date.now();
      const lastShown = lastShownRef.current.get(i18nKey);
      if (lastShown !== undefined && now - lastShown < rateLimitMs) {
        return;
      }
      lastShownRef.current.set(i18nKey, now);

      const translated = tRef.current(i18nKey, { error: errorMessage });
      showToastRef.current("error", translated);
    },
    [],
  );

  return { handle };
}
