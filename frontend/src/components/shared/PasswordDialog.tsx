import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

export type PasswordDialogMode = "set" | "verify" | "change" | "remove";

interface PasswordDialogProps {
  mode: PasswordDialogMode;
  onSubmit: (password: string, newPassword?: string) => Promise<boolean>;
  onCancel: () => void;
}

const MIN_PASSWORD_LENGTH = 4;

export function PasswordDialog({
  mode,
  onSubmit,
  onCancel,
}: PasswordDialogProps) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onCancel]);

  const validate = (): boolean => {
    setError("");
    if (mode === "set") {
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        setError(t("screenLock.passwordTooShort"));
        return false;
      }
      if (newPassword !== confirmPassword) {
        setError(t("screenLock.passwordsMismatch"));
        return false;
      }
    } else if (mode === "change") {
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        setError(t("screenLock.passwordTooShort"));
        return false;
      }
      if (newPassword !== confirmPassword) {
        setError(t("screenLock.passwordsMismatch"));
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setError("");
    try {
      let success: boolean;
      if (mode === "set") {
        success = await onSubmit(newPassword);
      } else if (mode === "change") {
        success = await onSubmit(currentPassword, newPassword);
      } else {
        success = await onSubmit(currentPassword);
      }
      if (!success) {
        setError(t("screenLock.incorrectPassword"));
      }
    } catch {
      setError(t("screenLock.incorrectPassword"));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const title = {
    set: t("screenLock.setPassword"),
    verify: t("screenLock.enterPassword"),
    change: t("screenLock.changePassword"),
    remove: t("screenLock.removePassword"),
  }[mode];

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="bg-notion-bg rounded-xl border border-notion-border shadow-2xl p-6 max-w-sm w-full mx-4">
        <h3 className="text-lg font-semibold text-notion-text mb-4">{title}</h3>

        <div className="flex flex-col gap-3" onKeyDown={handleKeyDown}>
          {(mode === "verify" || mode === "change" || mode === "remove") && (
            <input
              ref={inputRef}
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={
                mode === "change" || mode === "remove"
                  ? t("screenLock.currentPassword")
                  : t("screenLock.enterPassword")
              }
              className="w-full px-3 py-2 text-sm bg-notion-bg border border-notion-border rounded-lg text-notion-text placeholder:text-notion-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-notion-accent"
            />
          )}

          {(mode === "set" || mode === "change") && (
            <>
              <input
                ref={mode === "set" ? inputRef : undefined}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("screenLock.newPassword")}
                className="w-full px-3 py-2 text-sm bg-notion-bg border border-notion-border rounded-lg text-notion-text placeholder:text-notion-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-notion-accent"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("screenLock.confirmPassword")}
                className="w-full px-3 py-2 text-sm bg-notion-bg border border-notion-border rounded-lg text-notion-text placeholder:text-notion-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-notion-accent"
              />
            </>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-notion-text-secondary hover:text-notion-text rounded-lg hover:bg-notion-hover transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-sm text-white bg-notion-accent hover:bg-notion-accent/90 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? "..." : t("common.ok")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
