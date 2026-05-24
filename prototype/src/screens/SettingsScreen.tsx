import {
  Calendar as CalendarIcon,
  Check,
  ChevronRight,
  Clock,
  FileText,
  Info,
  Link as LinkIcon,
  Search,
  Settings as SettingsIcon,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useMockStore } from "../hooks/useMockStore";
import { resetAll, setNotification, setSettings } from "../lib/mockStore";
import type { AppSettings, Language, ThemeMode } from "../lib/types";

const C = {
  base: "#1e1e2e",
  mantle: "#181825",
  crust: "#11111b",
  surface0: "#313244",
  surface1: "#45475a",
  text: "#cdd6f4",
  subtext1: "#bac2de",
  subtext0: "#a6adc8",
  overlay0: "#6c7086",
  mauve: "#cba6f7",
  green: "#a6e3a1",
  red: "#f38ba8",
} as const;

const STR = {
  ja: {
    title: "設定",
    sectionDisplay: "表示",
    theme: "テーマ",
    fontSize: "フォントサイズ",
    language: "言語",
    materialsLayout: "Materials の既定表示",
    sectionNotifications: "通知",
    pomodoroEnd: "Pomodoro セッション終了",
    schedule10: "予定 10 分前リマインダー",
    schedule30: "予定 30 分前リマインダー",
    dailyUnwritten: "Daily 未記入 (20:00)",
    notifNote: "本番モバイルアプリで実通知化されます",
    sectionData: "データ",
    crossSearch: "横断検索",
    trash: "ゴミ箱",
    mockReset: "Mock データを初期化",
    sectionAbout: "About",
    version: "バージョン",
    license: "OSS ライセンス",
    repo: "リポジトリ",
    copy: "コピー",
    aboutProto: "このプロトタイプについて",
    previewBadge: "本番アプリで反映",
    light: "Light",
    dark: "Dark",
    system: "System",
    jaName: "日本語",
    enName: "English",
    card: "Card",
    row: "Row",
    confirmResetTitle: "Mock データを初期化しますか?",
    confirmResetMsg: "すべての変更が失われ、初期状態に戻ります",
    licenseBody: "MIT License - prototype only",
    aboutBody:
      "life-editor mobile UI プロトタイプ。Notes / Daily / Schedule / Work / Settings の試作実装",
  },
  en: {
    title: "Settings",
    sectionDisplay: "Display",
    theme: "Theme",
    fontSize: "Font size",
    language: "Language",
    materialsLayout: "Materials default layout",
    sectionNotifications: "Notifications",
    pomodoroEnd: "Pomodoro session end",
    schedule10: "Schedule 10-min reminder",
    schedule30: "Schedule 30-min reminder",
    dailyUnwritten: "Daily unwritten (20:00)",
    notifNote: "Real notifications enabled in production app",
    sectionData: "Data",
    crossSearch: "Cross search",
    trash: "Trash",
    mockReset: "Reset mock data",
    sectionAbout: "About",
    version: "Version",
    license: "OSS licenses",
    repo: "Repository",
    copy: "Copy",
    aboutProto: "About this prototype",
    previewBadge: "applied in production",
    light: "Light",
    dark: "Dark",
    system: "System",
    jaName: "日本語",
    enName: "English",
    card: "Card",
    row: "Row",
    confirmResetTitle: "Reset all mock data?",
    confirmResetMsg: "All changes will be lost",
    licenseBody: "MIT License - prototype only",
    aboutBody:
      "life-editor mobile UI prototype. Trial of Notes / Daily / Schedule / Work / Settings",
  },
} as const;

export function SettingsScreen() {
  const settings = useMockStore((s) => s.settings);
  const trashCount = useMockStore(
    (s) =>
      s.scheduleItems.filter((x) => x.isDeleted).length +
      s.notes.filter((x) => x.isDeleted).length +
      s.presets.filter((x) => x.isDeleted).length +
      s.timerSessions.filter((x) => x.isDeleted).length,
  );
  const nav = useNavigate();
  const [picker, setPicker] = useState<"theme" | "lang" | null>(null);
  const [showReset, setShowReset] = useState(false);
  const [showLicense, setShowLicense] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const t = STR[settings.language];

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(id);
  }, [toast]);

  const copyRepo = () => {
    const url = "https://github.com/sunbreak-pro/life-editor";
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(url)
        .then(() =>
          setToast(settings.language === "ja" ? "コピーしました" : "Copied"),
        );
    } else {
      setToast(url);
    }
  };

  return (
    <div
      className="mx-auto max-w-md h-screen flex flex-col relative overflow-hidden"
      style={{ background: C.base, color: C.text }}
    >
      <TopBar title={t.title} />
      <main
        className="flex-1 overflow-auto py-2"
        style={{ background: C.base }}
      >
        <Section header={t.sectionDisplay}>
          <PickerRow
            label={t.theme}
            value={
              settings.themeMode === "light"
                ? t.light
                : settings.themeMode === "dark"
                  ? t.dark
                  : t.system
            }
            onTap={() => setPicker("theme")}
            previewBadge={t.previewBadge}
          />
          <SliderRow
            label={t.fontSize}
            value={settings.fontSize}
            min={12}
            max={25}
            onChange={(v) =>
              setSettings({ fontSize: Math.max(12, Math.min(25, v)) })
            }
            previewBadge={t.previewBadge}
          />
          <PickerRow
            label={t.language}
            value={settings.language === "ja" ? t.jaName : t.enName}
            onTap={() => setPicker("lang")}
          />
          <SegmentedRow
            label={t.materialsLayout}
            options={[
              { id: "card", label: t.card },
              { id: "list", label: t.row },
            ]}
            value={settings.layoutDefaults.materialsLayout}
            onChange={(v) =>
              setSettings({
                layoutDefaults: { materialsLayout: v as "card" | "list" },
              })
            }
            isLast
          />
        </Section>

        <Section header={t.sectionNotifications}>
          <ToggleRow
            label={t.pomodoroEnd}
            value={settings.notifications.pomodoroSessionEnd}
            onChange={(v) => setNotification("pomodoroSessionEnd", v)}
          />
          <ToggleRow
            label={t.schedule10}
            value={settings.notifications.scheduleReminder10min}
            onChange={(v) => setNotification("scheduleReminder10min", v)}
          />
          <ToggleRow
            label={t.schedule30}
            value={settings.notifications.scheduleReminder30min}
            onChange={(v) => setNotification("scheduleReminder30min", v)}
          />
          <ToggleRow
            label={t.dailyUnwritten}
            value={settings.notifications.dailyUnwritten}
            onChange={(v) => setNotification("dailyUnwritten", v)}
            isLast
          />
        </Section>
        <div
          className="mx-4 -mt-2 mb-4 px-3 py-2 rounded-md flex items-center gap-2 text-[11px]"
          style={{ background: C.surface0, color: C.subtext0 }}
        >
          <Info size={12} />
          {t.notifNote}
        </div>

        <Section header={t.sectionData}>
          <NavRow
            icon={<Search size={18} />}
            label={t.crossSearch}
            onTap={() => nav("/cross-search")}
          />
          <NavRow
            icon={<Trash2 size={18} />}
            label={t.trash}
            badge={trashCount > 0 ? String(trashCount) : undefined}
            onTap={() => nav("/trash")}
          />
          <DangerRow
            icon={<Trash2 size={18} />}
            label={t.mockReset}
            onTap={() => setShowReset(true)}
            isLast
          />
        </Section>

        <Section header={t.sectionAbout}>
          <ValueRow label={t.version} value="prototype-v0.0.1" />
          <NavRow
            icon={<FileText size={18} />}
            label={t.license}
            onTap={() => setShowLicense(true)}
          />
          <ActionRow
            icon={<LinkIcon size={18} />}
            label={t.repo}
            actionLabel={t.copy}
            onAction={copyRepo}
          />
          <NavRow
            icon={<Info size={18} />}
            label={t.aboutProto}
            onTap={() => setShowAbout(true)}
            isLast
          />
        </Section>
      </main>
      <BottomTabBar />

      {picker === "theme" && (
        <RadioSheet
          title={t.theme}
          options={[
            { id: "light", label: t.light },
            { id: "dark", label: t.dark },
            { id: "system", label: t.system },
          ]}
          value={settings.themeMode}
          onPick={(v) => {
            setSettings({ themeMode: v as ThemeMode });
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      )}
      {picker === "lang" && (
        <RadioSheet
          title={t.language}
          options={[
            { id: "ja", label: t.jaName },
            { id: "en", label: t.enName },
          ]}
          value={settings.language}
          onPick={(v) => {
            setSettings({ language: v as Language });
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      )}
      {showReset && (
        <ConfirmModal
          title={t.confirmResetTitle}
          message={t.confirmResetMsg}
          danger
          coolDownMs={1000}
          onCancel={() => setShowReset(false)}
          onConfirm={() => {
            setShowReset(false);
            resetAll();
          }}
        />
      )}
      {showLicense && (
        <InfoModal
          title={t.license}
          body={t.licenseBody}
          onClose={() => setShowLicense(false)}
        />
      )}
      {showAbout && (
        <InfoModal
          title={t.aboutProto}
          body={t.aboutBody}
          onClose={() => setShowAbout(false)}
        />
      )}
      {toast && (
        <div className="absolute inset-x-0 bottom-20 flex justify-center pointer-events-none">
          <div
            className="px-4 py-2 rounded-md text-sm shadow-lg"
            style={{ background: C.surface0, color: C.text }}
          >
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

function TopBar({ title }: { title: string }) {
  return (
    <header
      className="h-12 flex items-center px-3 shrink-0"
      style={{ background: C.mantle, borderBottom: `1px solid ${C.surface1}` }}
    >
      <h1
        className="flex-1 text-center text-base font-medium"
        style={{ color: C.text }}
      >
        {title}
      </h1>
    </header>
  );
}

function Section({
  header,
  children,
}: {
  header: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4">
      <div
        className="px-4 py-2 text-[11px] uppercase tracking-wider"
        style={{ color: C.subtext0 }}
      >
        {header}
      </div>
      <div
        className="mx-4 rounded-xl overflow-hidden"
        style={{ background: C.surface0 }}
      >
        {children}
      </div>
    </section>
  );
}

function PickerRow({
  label,
  value,
  onTap,
  previewBadge,
  isLast,
}: {
  label: string;
  value: string;
  onTap: () => void;
  previewBadge?: string;
  isLast?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full min-h-[44px] px-4 py-3 flex items-center gap-3 text-left active:bg-white/5"
      style={{
        borderBottom: isLast ? undefined : `1px solid ${C.surface1}`,
      }}
    >
      <span className="text-sm flex-1" style={{ color: C.text }}>
        {label}
      </span>
      {previewBadge && <PreviewBadge label={previewBadge} />}
      <span className="text-sm" style={{ color: C.subtext0 }}>
        {value}
      </span>
      <ChevronRight size={16} color={C.overlay0} />
    </button>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  onChange,
  previewBadge,
  isLast,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  previewBadge?: string;
  isLast?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <div
      className="px-4 py-3 flex flex-col gap-2"
      style={{
        borderBottom: isLast ? undefined : `1px solid ${C.surface1}`,
      }}
    >
      <div className="flex items-center">
        <span className="text-sm flex-1" style={{ color: C.text }}>
          {label}
        </span>
        {previewBadge && <PreviewBadge label={previewBadge} />}
        <span className="text-sm font-mono ml-2" style={{ color: C.subtext1 }}>
          {draft}px
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={draft}
        onChange={(e) => setDraft(Number(e.target.value))}
        onPointerUp={() => onChange(draft)}
        onKeyUp={() => onChange(draft)}
        className="w-full"
        style={{ accentColor: C.mauve }}
      />
      <div
        className="text-center"
        style={{ fontSize: draft, color: C.subtext1, lineHeight: 1.3 }}
      >
        Aa あア亜 1234
      </div>
    </div>
  );
}

function SegmentedRow({
  label,
  options,
  value,
  onChange,
  isLast,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  isLast?: boolean;
}) {
  return (
    <div
      className="px-4 py-3 flex items-center gap-3"
      style={{
        borderBottom: isLast ? undefined : `1px solid ${C.surface1}`,
      }}
    >
      <span className="text-sm flex-1" style={{ color: C.text }}>
        {label}
      </span>
      <div
        className="grid grid-cols-2 rounded-md overflow-hidden"
        style={{ background: C.surface1 }}
      >
        {options.map((o) => {
          const active = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              className="px-3 h-8 text-xs"
              style={{
                background: active ? C.mauve : "transparent",
                color: active ? C.base : C.subtext1,
                fontWeight: active ? 600 : 400,
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  isLast,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  isLast?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="w-full min-h-[44px] px-4 py-3 flex items-center text-left"
      style={{
        borderBottom: isLast ? undefined : `1px solid ${C.surface1}`,
      }}
    >
      <span className="text-sm flex-1" style={{ color: C.text }}>
        {label}
      </span>
      <span
        className="w-10 h-6 rounded-full relative transition-colors"
        style={{ background: value ? C.mauve : C.surface1 }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full transition-transform"
          style={{
            background: value ? C.base : C.text,
            transform: value ? "translateX(18px)" : "translateX(2px)",
          }}
        />
      </span>
    </button>
  );
}

function NavRow({
  icon,
  label,
  badge,
  onTap,
  isLast,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  onTap: () => void;
  isLast?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full min-h-[44px] px-4 py-3 flex items-center gap-3 text-left active:bg-white/5"
      style={{
        borderBottom: isLast ? undefined : `1px solid ${C.surface1}`,
        color: C.text,
      }}
    >
      <span style={{ color: C.subtext1 }}>{icon}</span>
      <span className="text-sm flex-1">{label}</span>
      {badge && (
        <span
          className="text-[10px] px-2 py-0.5 rounded-full"
          style={{ background: C.mauve, color: C.base, fontWeight: 600 }}
        >
          {badge}
        </span>
      )}
      <ChevronRight size={16} color={C.overlay0} />
    </button>
  );
}

function DangerRow({
  icon,
  label,
  onTap,
  isLast,
}: {
  icon: React.ReactNode;
  label: string;
  onTap: () => void;
  isLast?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full min-h-[44px] px-4 py-3 flex items-center gap-3 text-left active:bg-white/5"
      style={{
        borderBottom: isLast ? undefined : `1px solid ${C.surface1}`,
        color: C.red,
      }}
    >
      {icon}
      <span className="text-sm flex-1">{label}</span>
    </button>
  );
}

function ValueRow({
  label,
  value,
  isLast,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <div
      className="px-4 py-3 min-h-[44px] flex items-center"
      style={{
        borderBottom: isLast ? undefined : `1px solid ${C.surface1}`,
      }}
    >
      <span className="text-sm flex-1" style={{ color: C.text }}>
        {label}
      </span>
      <span className="text-sm font-mono" style={{ color: C.subtext0 }}>
        {value}
      </span>
    </div>
  );
}

function ActionRow({
  icon,
  label,
  actionLabel,
  onAction,
  isLast,
}: {
  icon: React.ReactNode;
  label: string;
  actionLabel: string;
  onAction: () => void;
  isLast?: boolean;
}) {
  return (
    <div
      className="px-4 py-3 min-h-[44px] flex items-center gap-3"
      style={{
        borderBottom: isLast ? undefined : `1px solid ${C.surface1}`,
      }}
    >
      <span style={{ color: C.subtext1 }}>{icon}</span>
      <span className="text-sm flex-1" style={{ color: C.text }}>
        {label}
      </span>
      <button
        type="button"
        onClick={onAction}
        className="text-xs px-3 py-1 rounded-md"
        style={{ background: C.surface1, color: C.text }}
      >
        {actionLabel}
      </button>
    </div>
  );
}

function PreviewBadge({ label }: { label: string }) {
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full"
      style={{ background: C.surface1, color: C.subtext0 }}
    >
      {label}
    </span>
  );
}

function RadioSheet({
  title,
  options,
  value,
  onPick,
  onClose,
}: {
  title: string;
  options: { id: string; label: string }[];
  value: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="fixed inset-0"
        style={{ background: C.crust, opacity: 0.5 }}
      />
      <div
        className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full max-w-md rounded-t-2xl"
        style={{ background: C.mantle, color: C.text }}
      >
        <div className="flex flex-col items-center pt-2 pb-1">
          <span
            className="w-10 h-1 rounded-full"
            style={{ background: C.overlay0 }}
          />
        </div>
        <header
          className="h-10 flex items-center px-3"
          style={{ borderBottom: `1px solid ${C.surface1}` }}
        >
          <div className="flex-1 text-sm font-medium">{title}</div>
        </header>
        <div className="flex flex-col pb-2">
          {options.map((o) => {
            const active = o.id === value;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onPick(o.id)}
                className="min-h-[48px] px-4 flex items-center gap-3 text-left"
                style={{
                  borderBottom: `1px solid ${C.surface1}`,
                }}
              >
                <span
                  className="w-3 h-3 rounded-full"
                  style={{
                    background: active ? C.mauve : "transparent",
                    border: `1px solid ${active ? C.mauve : C.overlay0}`,
                  }}
                />
                <span className="text-sm flex-1">{o.label}</span>
                {active && <Check size={14} color={C.green} />}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function ConfirmModal({
  title,
  message,
  danger,
  coolDownMs,
  onCancel,
  onConfirm,
}: {
  title: string;
  message?: string;
  danger?: boolean;
  coolDownMs?: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(!coolDownMs);
  useEffect(() => {
    if (coolDownMs) {
      const t = window.setTimeout(() => setArmed(true), coolDownMs);
      return () => clearTimeout(t);
    }
  }, [coolDownMs]);
  return (
    <>
      <button
        type="button"
        onClick={onCancel}
        aria-label="閉じる"
        className="fixed inset-0"
        style={{ background: C.crust, opacity: 0.7 }}
      />
      <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="w-full max-w-xs rounded-2xl p-4 flex flex-col gap-3 pointer-events-auto"
          style={{ background: C.base, border: `1px solid ${C.surface1}` }}
        >
          <div className="text-sm font-medium" style={{ color: C.text }}>
            {title}
          </div>
          {message && (
            <div className="text-xs" style={{ color: C.subtext0 }}>
              {message}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-10 rounded-md text-sm"
              style={{ border: `1px solid ${C.surface1}`, color: C.text }}
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!armed}
              className="h-10 rounded-md text-sm font-medium disabled:opacity-50"
              style={{ background: danger ? C.red : C.mauve, color: C.base }}
            >
              {armed ? "実行" : "..."}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function InfoModal({
  title,
  body,
  onClose,
}: {
  title: string;
  body: string;
  onClose: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="fixed inset-0"
        style={{ background: C.crust, opacity: 0.5 }}
      />
      <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="w-full max-w-xs rounded-2xl p-4 flex flex-col gap-3 pointer-events-auto"
          style={{ background: C.base, border: `1px solid ${C.surface1}` }}
        >
          <div className="flex items-center">
            <div
              className="text-sm font-medium flex-1"
              style={{ color: C.text }}
            >
              {title}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="閉じる"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center"
            >
              <X size={16} color={C.text} />
            </button>
          </div>
          <div
            className="text-sm leading-relaxed whitespace-pre-line"
            style={{ color: C.subtext1 }}
          >
            {body}
          </div>
        </div>
      </div>
    </>
  );
}

function BottomTabBar() {
  const tabs: { to: string; label: string; Icon: typeof CalendarIcon }[] = [
    { to: "/schedule", label: "Sch", Icon: CalendarIcon },
    { to: "/work", label: "Wrk", Icon: Clock },
    { to: "/materials", label: "Mat", Icon: FileText },
    { to: "/settings", label: "Set", Icon: SettingsIcon },
  ];
  return (
    <nav
      className="h-14 grid grid-cols-4 shrink-0"
      style={{ background: C.mantle, borderTop: `1px solid ${C.surface1}` }}
    >
      {tabs.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end
          className="flex flex-col items-center justify-center gap-0.5 active:opacity-70"
          style={({ isActive }) => ({
            color: isActive ? C.mauve : C.overlay0,
          })}
        >
          <Icon size={20} />
          <span className="text-[10px]">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
