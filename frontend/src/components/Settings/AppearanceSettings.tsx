import { useTheme } from "../../hooks/useTheme";
import { useTranslation } from "react-i18next";

const FONT_SIZE_PX: Record<number, number> = {
  1: 12,
  2: 13,
  3: 14,
  4: 16,
  5: 18,
  6: 19,
  7: 20,
  8: 22,
  9: 23,
  10: 25,
};

function remToPx(rem: number): number {
  return Math.round(rem * 16);
}

function pxToRem(px: number): number {
  return px / 16;
}

export function AppearanceSettings() {
  const {
    theme,
    fontSize,
    setTheme,
    setFontSize,
    editorFontSize,
    editorFontFamily,
    editorLineHeight,
    editorPaddingInline,
    setEditorFontSize,
    setEditorFontFamily,
    setEditorLineHeight,
    setEditorPaddingInline,
  } = useTheme();
  const { t } = useTranslation();

  return (
    <div className="space-y-6" data-section-id="appearance">
      <h3 className="text-lg font-semibold text-notion-text">
        {t("settings.appearance")}
      </h3>

      <div className="flex items-center justify-between py-3">
        <div>
          <p className="text-sm font-medium text-notion-text">
            {t("settings.darkMode")}
          </p>
          <p className="text-xs text-notion-text-secondary">
            {t("settings.darkModeDesc")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTheme("light")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              theme === "light"
                ? "bg-notion-accent text-white"
                : "bg-notion-hover text-notion-text"
            }`}
          >
            Light
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              theme === "dark"
                ? "bg-notion-accent text-white"
                : "bg-notion-hover text-notion-text"
            }`}
          >
            Dark
          </button>
          <button
            onClick={() => setTheme("monochrome")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              theme === "monochrome"
                ? "bg-notion-accent text-white"
                : "bg-notion-hover text-notion-text"
            }`}
          >
            Noir (Light)
          </button>
          <button
            onClick={() => setTheme("monochrome-dark")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              theme === "monochrome-dark"
                ? "bg-notion-accent text-white"
                : "bg-notion-hover text-notion-text"
            }`}
          >
            Noir (Dark)
          </button>
        </div>
      </div>

      <div className="py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-notion-text">
            {t("settings.fontSize")}
          </p>
          <span className="text-xs text-notion-text-secondary tabular-nums">
            {FONT_SIZE_PX[fontSize] ?? 18}px
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="w-full accent-[var(--notion-accent)]"
        />
        <div className="flex justify-between text-xs text-notion-text-secondary mt-1">
          <span>{t("settings.fontSizeSmall")}</span>
          <span>{t("settings.fontSizeLarge")}</span>
        </div>
      </div>

      {/* Editor Settings */}
      <div className="border-t border-notion-border pt-5">
        <h4 className="text-sm font-semibold text-notion-text mb-4">
          {t("settings.editorSettings")}
        </h4>

        <div className="space-y-4">
          {/* Editor Font Size */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-notion-text">
                {t("settings.editorFontSize")}
              </p>
              <span className="text-xs text-notion-text-secondary tabular-nums">
                {remToPx(editorFontSize)}px
              </span>
            </div>
            <input
              type="range"
              min={14}
              max={24}
              step={1}
              value={remToPx(editorFontSize)}
              onChange={(e) =>
                setEditorFontSize(pxToRem(Number(e.target.value)))
              }
              className="w-full accent-[var(--notion-accent)]"
            />
            <div className="flex justify-between text-xs text-notion-text-secondary mt-1">
              <span>14px</span>
              <span>24px</span>
            </div>
          </div>

          {/* Font Family */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-notion-text">
              {t("settings.editorFontFamily")}
            </p>
            <select
              value={editorFontFamily}
              onChange={(e) => setEditorFontFamily(e.target.value)}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-notion-hover text-notion-text border border-notion-border outline-none"
            >
              <option value="system">System</option>
              <option value="serif">Serif</option>
              <option value="mono">Mono</option>
            </select>
          </div>

          {/* Line Height */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-notion-text">
                {t("settings.editorLineHeight")}
              </p>
              <span className="text-xs text-notion-text-secondary tabular-nums">
                {editorLineHeight.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min={1.2}
              max={2.4}
              step={0.1}
              value={editorLineHeight}
              onChange={(e) => setEditorLineHeight(Number(e.target.value))}
              className="w-full accent-[var(--notion-accent)]"
            />
            <div className="flex justify-between text-xs text-notion-text-secondary mt-1">
              <span>1.2</span>
              <span>2.4</span>
            </div>
          </div>

          {/* Content Padding */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-notion-text">
                {t("settings.editorPaddingInline")}
              </p>
              <span className="text-xs text-notion-text-secondary tabular-nums">
                {editorPaddingInline}px
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={120}
              step={8}
              value={editorPaddingInline}
              onChange={(e) => setEditorPaddingInline(Number(e.target.value))}
              className="w-full accent-[var(--notion-accent)]"
            />
            <div className="flex justify-between text-xs text-notion-text-secondary mt-1">
              <span>0px</span>
              <span>120px</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
