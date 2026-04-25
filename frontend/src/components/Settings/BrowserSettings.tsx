import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { useSidebarLinksContext } from "../../hooks/useSidebarLinksContext";

export function BrowserSettings() {
  const { t } = useTranslation();
  const { browsers, defaultBrowserId, setDefaultBrowserId } =
    useSidebarLinksContext();

  return (
    <div data-section-id="browser" className="space-y-3">
      <div className="flex items-center gap-3">
        <Globe size={18} className="text-notion-text-secondary" />
        <div>
          <p className="text-sm text-notion-text">
            {t("settings.browser.title", "Default browser for sidebar links")}
          </p>
          <p className="text-xs text-notion-text-secondary">
            {t(
              "settings.browser.description",
              "URL links from the sidebar open in this browser. Falls back to the system default when none is selected.",
            )}
          </p>
        </div>
      </div>

      {browsers.length === 0 ? (
        <p className="text-xs text-notion-text-secondary italic pl-7">
          {t(
            "settings.browser.none",
            "No supported browsers detected in /Applications. The system default will be used.",
          )}
        </p>
      ) : (
        <div className="pl-7 space-y-1.5">
          <label className="flex items-center gap-2 text-sm text-notion-text cursor-pointer">
            <input
              type="radio"
              name="defaultBrowser"
              checked={defaultBrowserId === null}
              onChange={() => setDefaultBrowserId(null)}
            />
            <span>{t("settings.browser.systemDefault", "System default")}</span>
          </label>
          {browsers.map((b) => (
            <label
              key={b.id}
              className="flex items-center gap-2 text-sm text-notion-text cursor-pointer"
            >
              <input
                type="radio"
                name="defaultBrowser"
                checked={defaultBrowserId === b.id}
                onChange={() => setDefaultBrowserId(b.id)}
              />
              <span>{b.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
