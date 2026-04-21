import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Delete } from "lucide-react";

export type NumericPadMode = "set" | "verify" | "change" | "remove";

interface NumericPadPasswordDialogProps {
  mode: NumericPadMode;
  onSubmit: (password: string, newPassword?: string) => Promise<boolean>;
  onCancel: () => void;
}

const MIN_LEN = 4;
const MAX_LEN = 8;

type Stage = "current" | "new" | "confirm";

export function NumericPadPasswordDialog({
  mode,
  onSubmit,
  onCancel,
}: NumericPadPasswordDialogProps) {
  const { t } = useTranslation();

  const initialStage: Stage =
    mode === "set"
      ? "new"
      : mode === "remove" || mode === "verify"
        ? "current"
        : "current";

  const [stage, setStage] = useState<Stage>(initialStage);
  const [currentDigits, setCurrentDigits] = useState("");
  const [newDigits, setNewDigits] = useState("");
  const [confirmDigits, setConfirmDigits] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const activeDigits =
    stage === "current"
      ? currentDigits
      : stage === "new"
        ? newDigits
        : confirmDigits;

  const title = {
    set: t("mobile.password.set", "Set password"),
    verify: t("mobile.password.enter", "Enter password"),
    change: t("mobile.password.change", "Change password"),
    remove: t("mobile.password.remove", "Remove password"),
  }[mode];

  const stageLabel =
    stage === "current"
      ? t("mobile.password.current", "Current password")
      : stage === "new"
        ? t("mobile.password.new", "New password")
        : t("mobile.password.confirm", "Confirm password");

  const setActive = (updater: (prev: string) => string) => {
    if (stage === "current") setCurrentDigits(updater);
    else if (stage === "new") setNewDigits(updater);
    else setConfirmDigits(updater);
  };

  const handleDigit = (d: string) => {
    setError("");
    setActive((prev) => (prev.length >= MAX_LEN ? prev : prev + d));
  };

  const handleDelete = () => {
    setError("");
    setActive((prev) => prev.slice(0, -1));
  };

  const advance = async () => {
    setError("");
    if (stage === "current") {
      if (currentDigits.length < MIN_LEN) {
        setError(t("mobile.password.tooShort", "At least 4 digits"));
        return;
      }
      if (mode === "verify" || mode === "remove") {
        setLoading(true);
        try {
          const ok = await onSubmit(currentDigits);
          if (!ok) setError(t("mobile.password.incorrect", "Incorrect"));
        } finally {
          setLoading(false);
        }
      } else {
        setStage("new");
      }
    } else if (stage === "new") {
      if (newDigits.length < MIN_LEN) {
        setError(t("mobile.password.tooShort", "At least 4 digits"));
        return;
      }
      setStage("confirm");
    } else {
      if (confirmDigits !== newDigits) {
        setError(t("mobile.password.mismatch", "Does not match"));
        return;
      }
      setLoading(true);
      try {
        const ok =
          mode === "set"
            ? await onSubmit(newDigits)
            : await onSubmit(currentDigits, newDigits);
        if (!ok) setError(t("mobile.password.incorrect", "Incorrect"));
      } finally {
        setLoading(false);
      }
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-notion-bg-primary pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-between border-b border-notion-border px-4 py-3">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-notion-accent"
        >
          {t("common.cancel", "Cancel")}
        </button>
        <h2 className="text-sm font-semibold text-notion-text-primary">
          {title}
        </h2>
        <span className="w-12" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-8">
        <p className="mb-4 text-xs text-notion-text-secondary">{stageLabel}</p>
        <div className="mb-3 flex gap-3">
          {Array.from({ length: MAX_LEN }).map((_, i) => {
            const filled = i < activeDigits.length;
            const visible = i < Math.max(MIN_LEN, activeDigits.length);
            if (!visible) return null;
            return (
              <span
                key={i}
                className={`h-3 w-3 rounded-full transition-colors ${
                  filled
                    ? "bg-notion-text-primary"
                    : "border border-notion-border bg-transparent"
                }`}
              />
            );
          })}
        </div>
        {error && <p className="h-4 text-xs text-red-500">{error}</p>}
        {!error && <span className="h-4" />}
      </div>

      <div className="grid grid-cols-3 gap-1 px-6 pb-6">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => handleDigit(String(n))}
            disabled={loading}
            className="h-14 rounded-lg bg-notion-hover text-2xl font-light text-notion-text-primary active:bg-notion-border disabled:opacity-50"
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={advance}
          disabled={loading || activeDigits.length < MIN_LEN}
          className="h-14 rounded-lg text-sm font-medium text-notion-accent disabled:opacity-40"
        >
          {stage === "confirm" || mode === "verify" || mode === "remove"
            ? t("common.ok", "OK")
            : t("common.next", "Next")}
        </button>
        <button
          type="button"
          onClick={() => handleDigit("0")}
          disabled={loading}
          className="h-14 rounded-lg bg-notion-hover text-2xl font-light text-notion-text-primary active:bg-notion-border disabled:opacity-50"
        >
          0
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={loading || activeDigits.length === 0}
          className="flex h-14 items-center justify-center rounded-lg text-notion-text-primary disabled:opacity-40"
        >
          <Delete size={22} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
