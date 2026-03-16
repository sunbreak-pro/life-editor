import { useState } from "react";
import { Bot } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SetupResult {
  success: boolean;
  message: string;
  claudeInstalled: boolean;
}

export function ClaudeSetupSection() {
  const { t } = useTranslation();
  const [result, setResult] = useState<SetupResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setLoading(true);
    try {
      const res =
        await window.electronAPI?.invoke<SetupResult>("claude:registerMcp");
      if (res) setResult(res);
    } catch (e) {
      setResult({
        success: false,
        message: e instanceof Error ? e.message : String(e),
        claudeInstalled: false,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-section-id="claude-setup">
      <h3 className="text-lg font-semibold text-notion-text mb-3 flex items-center gap-2">
        <Bot size={20} />
        {t("settings.claude.title")}
      </h3>
      <p className="text-sm text-notion-text-secondary mb-3">
        {t("settings.claude.description")}
      </p>
      <button
        onClick={handleRegister}
        disabled={loading}
        className="px-4 py-2 bg-notion-accent text-white rounded-md text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading
          ? t("settings.claude.registering")
          : t("settings.claude.register")}
      </button>
      {result && (
        <p
          className={`mt-2 text-sm ${result.success ? "text-green-500" : "text-red-500"}`}
        >
          {result.success
            ? t("settings.claude.success")
            : result.claudeInstalled
              ? t("settings.claude.failed", { error: result.message })
              : t("settings.claude.notInstalled")}
        </p>
      )}
    </div>
  );
}
