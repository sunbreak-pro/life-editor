import { useCallback, useRef, useState } from "react";
import { updateDisplayName } from "@life-editor/shared";

/** Already-translated copy for every outcome of a profile save. */
export interface ProfileUpdateMessages {
  /** Supabase refused the write. */
  generic: string;
  /** Shown after a successful save. */
  done: string;
}

export interface ProfileUpdateState {
  displayName: string;
  setDisplayName: (value: string) => void;
  /**
   * Seeds the field with the stored name once the session has been read.
   * Ignored after the user has typed, so a slow read cannot overwrite them.
   */
  load: (stored: string) => void;
  /** Already-translated error, or null. */
  error: string | null;
  /** Already-translated success line, or null. */
  notice: string | null;
  busy: boolean;
  submit: () => void;
}

/*
 * Display-name state + submit for Settings' Profile card (#1624). Same shape
 * as usePasswordUpdate, for the same reasons: an in-flight ref guards double
 * submits within one frame, typing clears the last verdict, and the raw
 * Supabase message goes to the console while the screen shows catalog text.
 *
 * Nothing here tells the sidebar. A successful updateUser fires USER_UPDATED,
 * App stores the new session, and MainScreen reads the name off it — so the
 * sidebar and this field cannot disagree about what was saved.
 */
export function useProfileUpdate(
  messages: ProfileUpdateMessages,
): ProfileUpdateState {
  const [displayName, setDisplayNameValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const touched = useRef(false);

  const setDisplayName = useCallback((value: string) => {
    touched.current = true;
    setDisplayNameValue(value);
    setError(null);
    setNotice(null);
  }, []);

  const load = useCallback((stored: string) => {
    if (touched.current) return;
    setDisplayNameValue(stored);
  }, []);

  const submit = useCallback(() => {
    void (async () => {
      if (inFlight.current) return;
      setError(null);
      setNotice(null);
      inFlight.current = true;
      setBusy(true);
      let failure: string | null;
      try {
        failure = (await updateDisplayName(displayName)).error;
      } catch (e: unknown) {
        failure = e instanceof Error ? e.message : String(e);
      }
      inFlight.current = false;
      setBusy(false);
      if (failure) {
        console.error("[auth] updateDisplayName", failure);
        setError(messages.generic);
        return;
      }
      // Show what was stored, not what was typed: the trim happens on write.
      setDisplayNameValue(displayName.trim());
      setNotice(messages.done);
    })();
  }, [displayName, messages]);

  return {
    displayName,
    setDisplayName,
    load,
    error,
    notice,
    busy,
    submit,
  };
}
