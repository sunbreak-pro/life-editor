import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { X, Search } from "lucide-react";
import { getDataService } from "../../services";
import type {
  InstalledApp,
  SidebarLink,
  SidebarLinkKind,
} from "../../types/sidebarLink";
import {
  LUCIDE_ICON_NAMES,
  LUCIDE_ICON_REGISTRY,
  formatLucideIconValue,
  parseLucideIconName,
} from "./lucideIconRegistry";

type IconMode = "emoji" | "lucide";

interface SidebarLinkAddDialogProps {
  initial: SidebarLink | null;
  onSubmit: (input: {
    kind: SidebarLinkKind;
    name: string;
    target: string;
    emoji: string | null;
  }) => Promise<void>;
  onClose: () => void;
}

export function SidebarLinkAddDialog({
  initial,
  onSubmit,
  onClose,
}: SidebarLinkAddDialogProps) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<SidebarLinkKind>(initial?.kind ?? "url");
  const [name, setName] = useState(initial?.name ?? "");
  const [target, setTarget] = useState(initial?.target ?? "");
  const initialLucide = parseLucideIconName(initial?.emoji ?? null);
  const [iconMode, setIconMode] = useState<IconMode>(
    initialLucide ? "lucide" : "emoji",
  );
  const [emoji, setEmoji] = useState(
    initialLucide ? "" : (initial?.emoji ?? ""),
  );
  const [lucideIcon, setLucideIcon] = useState<string | null>(initialLucide);
  const [iconQuery, setIconQuery] = useState("");
  const [appQuery, setAppQuery] = useState("");
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [appsLoaded, setAppsLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lazy-load /Applications listing only when the user switches to "App" mode.
  // Avoids spawning a filesystem read on Settings page open for users who
  // never use app links.
  useEffect(() => {
    if (kind !== "app" || appsLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await getDataService().listApplications();
        if (!cancelled) {
          setApps(list);
          setAppsLoaded(true);
        }
      } catch {
        if (!cancelled) setAppsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, appsLoaded]);

  const filteredApps = useMemo(() => {
    const q = appQuery.trim().toLowerCase();
    if (q === "") return apps.slice(0, 60);
    return apps.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 60);
  }, [apps, appQuery]);

  const filteredIcons = useMemo(() => {
    const q = iconQuery.trim().toLowerCase();
    if (q === "") return LUCIDE_ICON_NAMES;
    return LUCIDE_ICON_NAMES.filter((n) => n.toLowerCase().includes(q));
  }, [iconQuery]);

  const canSubmit =
    name.trim().length > 0 && target.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const iconValue: string | null =
        iconMode === "lucide"
          ? lucideIcon
            ? formatLucideIconValue(lucideIcon)
            : null
          : emoji.trim() === ""
            ? null
            : emoji.trim();
      await onSubmit({
        kind,
        name: name.trim(),
        target: target.trim(),
        emoji: iconValue,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[600px] max-w-[92vw] bg-notion-bg border border-notion-border rounded-lg shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-notion-border">
          <div className="text-sm font-medium text-notion-text">
            {initial
              ? t("sidebarLinks.editTitle", "Edit Link")
              : t("sidebarLinks.addTitle", "Add Link")}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1 rounded hover:bg-notion-hover text-notion-text-secondary"
            aria-label={t("common.close", "Close")}
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-3">
          <div className="space-y-3">
            {/* Kind toggle */}
            <div>
              <label className="block text-[10px] text-notion-text-secondary mb-1 uppercase tracking-wide">
                {t("sidebarLinks.kindLabel", "Type")}
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setKind("url")}
                  className={`flex-1 px-2 py-1.5 text-xs rounded-md border transition-colors ${
                    kind === "url"
                      ? "border-notion-accent bg-notion-accent/10 text-notion-accent"
                      : "border-notion-border text-notion-text-secondary hover:bg-notion-hover"
                  }`}
                >
                  {t("sidebarLinks.kindUrl", "URL")}
                </button>
                <button
                  type="button"
                  onClick={() => setKind("app")}
                  className={`flex-1 px-2 py-1.5 text-xs rounded-md border transition-colors ${
                    kind === "app"
                      ? "border-notion-accent bg-notion-accent/10 text-notion-accent"
                      : "border-notion-border text-notion-text-secondary hover:bg-notion-hover"
                  }`}
                >
                  {t("sidebarLinks.kindApp", "App (macOS)")}
                </button>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-[10px] text-notion-text-secondary mb-1 uppercase tracking-wide">
                {t("sidebarLinks.nameLabel", "Display name")}
              </label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  kind === "url"
                    ? t("sidebarLinks.namePlaceholderUrl", "Anthropic")
                    : t("sidebarLinks.namePlaceholderApp", "Slack")
                }
                className="w-full px-2 py-1.5 text-xs bg-notion-bg-secondary border border-notion-border rounded-md text-notion-text outline-none focus:border-notion-accent/50"
              />
            </div>

            {/* Target */}
            {kind === "url" ? (
              <div>
                <label className="block text-[10px] text-notion-text-secondary mb-1 uppercase tracking-wide">
                  {t("sidebarLinks.urlLabel", "URL")}
                </label>
                <input
                  type="url"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-2 py-1.5 text-xs bg-notion-bg-secondary border border-notion-border rounded-md text-notion-text outline-none focus:border-notion-accent/50"
                />
              </div>
            ) : (
              <div>
                <label className="block text-[10px] text-notion-text-secondary mb-1 uppercase tracking-wide">
                  {t("sidebarLinks.appLabel", "Application")}
                </label>
                <div className="relative mb-1">
                  <Search
                    size={11}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-notion-text-secondary"
                  />
                  <input
                    type="text"
                    value={appQuery}
                    onChange={(e) => setAppQuery(e.target.value)}
                    placeholder={t(
                      "sidebarLinks.appSearchPlaceholder",
                      "Search /Applications…",
                    )}
                    className="w-full pl-7 pr-2 py-1.5 text-xs bg-notion-bg-secondary border border-notion-border rounded-md text-notion-text outline-none focus:border-notion-accent/50"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto bg-notion-bg-secondary border border-notion-border rounded-md">
                  {!appsLoaded ? (
                    <div className="px-2 py-1 text-[11px] text-notion-text-secondary italic">
                      {t("common.loading", "Loading…")}
                    </div>
                  ) : filteredApps.length === 0 ? (
                    <div className="px-2 py-1 text-[11px] text-notion-text-secondary italic">
                      {t("sidebarLinks.appNoResults", "No apps found")}
                    </div>
                  ) : (
                    filteredApps.map((app) => (
                      <button
                        key={app.path}
                        type="button"
                        onClick={() => {
                          setTarget(app.path);
                          if (name.trim() === "") setName(app.name);
                        }}
                        className={`w-full text-left px-2 py-1 text-xs hover:bg-notion-hover ${
                          target === app.path
                            ? "bg-notion-accent/10 text-notion-accent"
                            : "text-notion-text"
                        }`}
                      >
                        {app.name}
                      </button>
                    ))
                  )}
                </div>
                {target.trim() !== "" && (
                  <div className="mt-1 text-[10px] text-notion-text-secondary truncate">
                    {target}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Icon (emoji or Lucide) */}
          <div>
            <label className="block text-[10px] text-notion-text-secondary mb-1 uppercase tracking-wide">
              {t("sidebarLinks.iconLabel", "Icon (optional)")}
            </label>
            <div className="flex gap-1 mb-2">
              <button
                type="button"
                onClick={() => setIconMode("emoji")}
                className={`flex-1 px-2 py-1 text-xs rounded-md border transition-colors ${
                  iconMode === "emoji"
                    ? "border-notion-accent bg-notion-accent/10 text-notion-accent"
                    : "border-notion-border text-notion-text-secondary hover:bg-notion-hover"
                }`}
              >
                {t("sidebarLinks.iconModeEmoji", "Emoji")}
              </button>
              <button
                type="button"
                onClick={() => setIconMode("lucide")}
                className={`flex-1 px-2 py-1 text-xs rounded-md border transition-colors ${
                  iconMode === "lucide"
                    ? "border-notion-accent bg-notion-accent/10 text-notion-accent"
                    : "border-notion-border text-notion-text-secondary hover:bg-notion-hover"
                }`}
              >
                {t("sidebarLinks.iconModeLucide", "Lucide")}
              </button>
            </div>

            {iconMode === "emoji" ? (
              <input
                type="text"
                value={emoji ?? ""}
                maxLength={4}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="🎨"
                className="w-20 px-2 py-1.5 text-sm bg-notion-bg-secondary border border-notion-border rounded-md text-notion-text outline-none focus:border-notion-accent/50"
              />
            ) : (
              <div>
                <div className="relative mb-1">
                  <Search
                    size={11}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-notion-text-secondary"
                  />
                  <input
                    type="text"
                    value={iconQuery}
                    onChange={(e) => setIconQuery(e.target.value)}
                    placeholder={t(
                      "sidebarLinks.iconSearchPlaceholder",
                      "Search Lucide icons…",
                    )}
                    className="w-full pl-7 pr-2 py-1.5 text-xs bg-notion-bg-secondary border border-notion-border rounded-md text-notion-text outline-none focus:border-notion-accent/50"
                  />
                </div>
                <div className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto bg-notion-bg-secondary border border-notion-border rounded-md p-1">
                  {filteredIcons.length === 0 ? (
                    <div className="col-span-8 px-2 py-1 text-[11px] text-notion-text-secondary italic">
                      {t("sidebarLinks.iconNoResults", "No icons found")}
                    </div>
                  ) : (
                    filteredIcons.map((iconName) => {
                      const Icon = LUCIDE_ICON_REGISTRY[iconName];
                      const selected = lucideIcon === iconName;
                      return (
                        <button
                          key={iconName}
                          type="button"
                          onClick={() => setLucideIcon(iconName)}
                          title={iconName}
                          className={`flex items-center justify-center aspect-square rounded-md transition-colors ${
                            selected
                              ? "bg-notion-accent/20 text-notion-accent"
                              : "text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text"
                          }`}
                        >
                          <Icon size={16} />
                        </button>
                      );
                    })
                  )}
                </div>
                {lucideIcon && (
                  <div className="mt-1 text-[10px] text-notion-text-secondary">
                    {lucideIcon}
                  </div>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="col-span-2 text-[11px] text-red-500 break-words">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-notion-border">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1.5 text-xs rounded-md text-notion-text-secondary hover:bg-notion-hover"
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`px-3 py-1.5 text-xs rounded-md ${
              canSubmit
                ? "bg-notion-accent text-white hover:opacity-90"
                : "bg-notion-bg-secondary text-notion-text-secondary cursor-not-allowed"
            }`}
          >
            {initial ? t("common.save", "Save") : t("common.add", "Add")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
