import { Globe } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useTranslation } from "react-i18next";
import type { Language } from "../../context/ThemeContext";

const LANGUAGES: { value: Language; labelKey: string }[] = [
  { value: "en", labelKey: "settings.english" },
  { value: "ja", labelKey: "settings.japanese" },
];

export function LanguageSettings() {
  const { language, setLanguage } = useTheme();
  const { t } = useTranslation();

  return (
    <div className="space-y-4" data-section-id="language">
      <div className="flex items-center gap-2">
        <Globe size={18} className="text-notion-text-secondary" />
        <h3 className="text-lg font-semibold text-notion-text">
          {t("settings.language")}
        </h3>
      </div>
      <p className="text-xs text-notion-text-secondary">
        {t("settings.languageDesc")}
      </p>
      <div className="flex gap-2">
        {LANGUAGES.map(({ value, labelKey }) => (
          <button
            key={value}
            onClick={() => setLanguage(value)}
            className={`px-4 py-2 text-sm rounded-md border transition-colors ${
              language === value
                ? "border-notion-accent bg-notion-accent/10 text-notion-accent"
                : "border-notion-border text-notion-text-secondary hover:border-notion-text-secondary"
            }`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
