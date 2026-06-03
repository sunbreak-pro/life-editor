import {
  Accessibility,
  Bell,
  Check,
  ChevronRight,
  Cloud,
  Cog,
  Download,
  FileText,
  Info,
  KeyRound,
  Link as LinkIcon,
  Lock,
  LogOut,
  Palette,
  Search,
  Trash2,
  UploadCloud,
  User,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BottomSheet } from "../components/BottomSheet";
import { Drawer } from "../components/Drawer";
import { useShell } from "../context/ShellContext";
import { useMockStore } from "../hooks/useMockStore";
import { resetAll, setNotification, setSettings } from "../lib/mockStore";
import { C } from "../lib/theme";
import type { Language, ThemeMode } from "../lib/types";

type CategoryId =
  | "general"
  | "account"
  | "appearance"
  | "accessibility"
  | "notifications"
  | "sync"
  | "privacy"
  | "about";

type StartupSection = "schedule" | "work" | "materials";
type AccentColor = "mauve" | "blue" | "green" | "peach";
type NotifSound = "none" | "default" | "chime";

/**
 * Mock-only settings that aren't backed by the shared store. They make the new
 * categories feel interactive (toggles flip, selections show a check) but reset
 * on reload — prototype scope, no real wiring (see settings redesign decision).
 */
interface ExtraSettings {
  startupSection: StartupSection;
  weekStartsMonday: boolean;
  displayName: string;
  accentColor: AccentColor;
  reduceMotion: boolean;
  highContrast: boolean;
  boldText: boolean;
  largerTouchTargets: boolean;
  haptics: boolean;
  pushEnabled: boolean;
  notifSound: NotifSound;
  cloudSync: boolean;
  wifiOnly: boolean;
  appLock: boolean;
  hideInAppSwitcher: boolean;
}

const DEFAULT_EXTRA: ExtraSettings = {
  startupSection: "schedule",
  weekStartsMonday: true,
  displayName: "ユーザー",
  accentColor: "mauve",
  reduceMotion: false,
  highContrast: false,
  boldText: false,
  largerTouchTargets: false,
  haptics: true,
  pushEnabled: true,
  notifSound: "default",
  cloudSync: true,
  wifiOnly: false,
  appLock: false,
  hideInAppSwitcher: false,
};

const STR = {
  ja: {
    title: "設定",
    hint: "メニュー（≡）からカテゴリを切り替えられます",
    catGeneral: "一般",
    catAccount: "アカウント",
    catAppearance: "表示",
    catAccessibility: "アクセシビリティ",
    catNotifications: "通知",
    catSync: "同期とバックアップ",
    catPrivacy: "プライバシー",
    catAbout: "アプリについて",
    language: "言語",
    startup: "起動画面",
    startupSchedule: "予定",
    startupWork: "作業",
    startupMaterials: "資料",
    materialsLayout: "資料の既定表示",
    weekStartsMonday: "週の始まりを月曜にする",
    displayName: "プロフィール名",
    email: "メールアドレス",
    changePassword: "パスワードを変更",
    signOut: "サインアウト",
    signOutTitle: "サインアウトしますか?",
    signedOut: "サインアウトしました（モック）",
    theme: "テーマ",
    fontSize: "フォントサイズ",
    accentColor: "アクセントカラー",
    reduceMotion: "視差効果を減らす",
    highContrast: "ハイコントラスト",
    boldText: "文字を太くする",
    largerTouchTargets: "タップ領域を拡大",
    haptics: "触覚フィードバック",
    a11yNote: "見た目のみのモック設定です",
    pushEnabled: "プッシュ通知を許可",
    pomodoroEnd: "Pomodoro セッション終了",
    schedule10: "予定 10 分前リマインダー",
    schedule30: "予定 30 分前リマインダー",
    dailyUnwritten: "Daily 未記入 (20:00)",
    notifSound: "通知サウンド",
    soundNone: "なし",
    soundDefault: "デフォルト",
    soundChime: "チャイム",
    notifNote: "本番モバイルアプリで実通知化されます",
    cloudSync: "クラウド同期",
    wifiOnly: "Wi-Fi のみで同期",
    lastSynced: "最終同期",
    lastSyncedValue: "今日 14:32",
    backupNow: "今すぐバックアップ",
    run: "実行",
    backedUp: "バックアップしました（モック）",
    syncNote: "クラウド同期は作者本人のみ有効です",
    appLock: "アプリロック (Face ID)",
    hideInAppSwitcher: "App Switcher で内容を隠す",
    clearSearchHistory: "検索履歴を消去",
    clear: "消去",
    cleared: "消去しました（モック）",
    exportData: "データを書き出す",
    version: "バージョン",
    license: "OSS ライセンス",
    repo: "リポジトリ",
    copy: "コピー",
    aboutProto: "このプロトタイプについて",
    mockReset: "Mock データを初期化",
    previewBadge: "本番アプリで反映",
    light: "Light",
    dark: "Dark",
    system: "System",
    jaName: "日本語",
    enName: "English",
    card: "Card",
    row: "Row",
    crossSearch: "横断検索",
    trash: "ゴミ箱",
    confirmResetTitle: "Mock データを初期化しますか?",
    confirmResetMsg: "すべての変更が失われ、初期状態に戻ります",
    licenseBody: "MIT License - prototype only",
    aboutBody:
      "life-editor mobile UI プロトタイプ。Notes / Daily / Schedule / Work / Settings の試作実装",
    passwordTitle: "パスワードを変更",
    passwordBody: "本番アプリでパスワード変更フローが開きます（モック）",
    exportTitle: "データを書き出す",
    exportBody: "本番アプリでエクスポートが実行されます（モック）",
    cancel: "キャンセル",
    close: "閉じる",
  },
  en: {
    title: "Settings",
    hint: "Switch categories from the menu (≡)",
    catGeneral: "General",
    catAccount: "Account",
    catAppearance: "Appearance",
    catAccessibility: "Accessibility",
    catNotifications: "Notifications",
    catSync: "Sync & Backup",
    catPrivacy: "Privacy",
    catAbout: "About",
    language: "Language",
    startup: "Startup screen",
    startupSchedule: "Schedule",
    startupWork: "Work",
    startupMaterials: "Materials",
    materialsLayout: "Materials default layout",
    weekStartsMonday: "Start week on Monday",
    displayName: "Display name",
    email: "Email",
    changePassword: "Change password",
    signOut: "Sign out",
    signOutTitle: "Sign out?",
    signedOut: "Signed out (mock)",
    theme: "Theme",
    fontSize: "Font size",
    accentColor: "Accent color",
    reduceMotion: "Reduce motion",
    highContrast: "High contrast",
    boldText: "Bold text",
    largerTouchTargets: "Larger touch targets",
    haptics: "Haptic feedback",
    a11yNote: "Mock visual-only settings",
    pushEnabled: "Allow push notifications",
    pomodoroEnd: "Pomodoro session end",
    schedule10: "Schedule 10-min reminder",
    schedule30: "Schedule 30-min reminder",
    dailyUnwritten: "Daily unwritten (20:00)",
    notifSound: "Notification sound",
    soundNone: "None",
    soundDefault: "Default",
    soundChime: "Chime",
    notifNote: "Real notifications enabled in production app",
    cloudSync: "Cloud sync",
    wifiOnly: "Sync over Wi-Fi only",
    lastSynced: "Last synced",
    lastSyncedValue: "Today 14:32",
    backupNow: "Back up now",
    run: "Run",
    backedUp: "Backed up (mock)",
    syncNote: "Cloud sync is enabled for the owner only",
    appLock: "App lock (Face ID)",
    hideInAppSwitcher: "Hide content in App Switcher",
    clearSearchHistory: "Clear search history",
    clear: "Clear",
    cleared: "Cleared (mock)",
    exportData: "Export data",
    version: "Version",
    license: "OSS licenses",
    repo: "Repository",
    copy: "Copy",
    aboutProto: "About this prototype",
    mockReset: "Reset mock data",
    previewBadge: "applied in production",
    light: "Light",
    dark: "Dark",
    system: "System",
    jaName: "日本語",
    enName: "English",
    card: "Card",
    row: "Row",
    crossSearch: "Cross search",
    trash: "Trash",
    confirmResetTitle: "Reset all mock data?",
    confirmResetMsg: "All changes will be lost",
    licenseBody: "MIT License - prototype only",
    aboutBody:
      "life-editor mobile UI prototype. Trial of Notes / Daily / Schedule / Work / Settings",
    passwordTitle: "Change password",
    passwordBody: "Opens the password change flow in the production app (mock)",
    exportTitle: "Export data",
    exportBody: "Runs an export in the production app (mock)",
    cancel: "Cancel",
    close: "Close",
  },
} as const;

type Strings = (typeof STR)["ja"];

const CATEGORIES: {
  id: CategoryId;
  icon: LucideIcon;
  labelKey: keyof Strings;
}[] = [
  { id: "general", icon: Cog, labelKey: "catGeneral" },
  { id: "account", icon: User, labelKey: "catAccount" },
  { id: "appearance", icon: Palette, labelKey: "catAppearance" },
  { id: "accessibility", icon: Accessibility, labelKey: "catAccessibility" },
  { id: "notifications", icon: Bell, labelKey: "catNotifications" },
  { id: "sync", icon: Cloud, labelKey: "catSync" },
  { id: "privacy", icon: Lock, labelKey: "catPrivacy" },
  { id: "about", icon: Info, labelKey: "catAbout" },
];

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
  const { sidebarOpen, closeSidebar } = useShell();

  const [category, setCategory] = useState<CategoryId>("general");
  const [extra, setExtra] = useState<ExtraSettings>(DEFAULT_EXTRA);
  const [picker, setPicker] = useState<
    "theme" | "lang" | "startup" | "notifSound" | null
  >(null);
  const [showReset, setShowReset] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);
  const [info, setInfo] = useState<{ title: string; body: string } | null>(
    null,
  );
  const [toast, setToast] = useState<string | null>(null);
  const t = STR[settings.language];

  const patchExtra = (p: Partial<ExtraSettings>): void =>
    setExtra((e) => ({ ...e, ...p }));

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(id);
  }, [toast]);

  const copyRepo = (): void => {
    const url = "https://github.com/sunbreak-pro/life-editor";
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(url)
        .then(() =>
          setToast(settings.language === "ja" ? "コピーしました" : "Copied"),
        )
        .catch(() => setToast(url));
    } else {
      setToast(url);
    }
  };

  const themeLabel =
    settings.themeMode === "light"
      ? t.light
      : settings.themeMode === "dark"
        ? t.dark
        : t.system;
  const startupLabel =
    extra.startupSection === "work"
      ? t.startupWork
      : extra.startupSection === "materials"
        ? t.startupMaterials
        : t.startupSchedule;
  const notifSoundLabel =
    extra.notifSound === "none"
      ? t.soundNone
      : extra.notifSound === "chime"
        ? t.soundChime
        : t.soundDefault;

  const activeMeta = CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];
  const ActiveIcon = activeMeta.icon;

  return (
    <div
      className="h-full flex flex-col relative overflow-hidden"
      style={{ background: C.base, color: C.text }}
    >
      <main
        className="flex-1 min-h-0 overflow-y-auto py-2"
        style={{ background: C.base }}
      >
        <div className="px-4 pt-2 pb-1 flex items-center gap-2">
          <ActiveIcon size={20} color={C.mauve} />
          <h1 className="text-lg font-semibold" style={{ color: C.text }}>
            {t[activeMeta.labelKey]}
          </h1>
        </div>
        <p className="px-4 pb-2 text-[11px]" style={{ color: C.subtext0 }}>
          {t.hint}
        </p>

        {category === "general" && (
          <Section>
            <PickerRow
              label={t.language}
              value={settings.language === "ja" ? t.jaName : t.enName}
              onTap={() => setPicker("lang")}
            />
            <PickerRow
              label={t.startup}
              value={startupLabel}
              onTap={() => setPicker("startup")}
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
            />
            <ToggleRow
              label={t.weekStartsMonday}
              value={extra.weekStartsMonday}
              onChange={(v) => patchExtra({ weekStartsMonday: v })}
              isLast
            />
          </Section>
        )}

        {category === "account" && (
          <Section>
            <ValueRow label={t.displayName} value={extra.displayName} />
            <ValueRow label={t.email} value="user@example.com" />
            <NavRow
              icon={<KeyRound size={18} />}
              label={t.changePassword}
              onTap={() =>
                setInfo({ title: t.passwordTitle, body: t.passwordBody })
              }
            />
            <DangerRow
              icon={<LogOut size={18} />}
              label={t.signOut}
              onTap={() => setShowSignOut(true)}
              isLast
            />
          </Section>
        )}

        {category === "appearance" && (
          <Section>
            <PickerRow
              label={t.theme}
              value={themeLabel}
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
            <ColorRow
              label={t.accentColor}
              value={extra.accentColor}
              options={[
                { id: "mauve", label: "Mauve", color: C.mauve },
                { id: "blue", label: "Blue", color: C.blue },
                { id: "green", label: "Green", color: C.green },
                { id: "peach", label: "Peach", color: C.peach },
              ]}
              onChange={(v) => patchExtra({ accentColor: v as AccentColor })}
              isLast
            />
          </Section>
        )}

        {category === "accessibility" && (
          <>
            <Section>
              <ToggleRow
                label={t.reduceMotion}
                value={extra.reduceMotion}
                onChange={(v) => patchExtra({ reduceMotion: v })}
              />
              <ToggleRow
                label={t.highContrast}
                value={extra.highContrast}
                onChange={(v) => patchExtra({ highContrast: v })}
              />
              <ToggleRow
                label={t.boldText}
                value={extra.boldText}
                onChange={(v) => patchExtra({ boldText: v })}
              />
              <ToggleRow
                label={t.largerTouchTargets}
                value={extra.largerTouchTargets}
                onChange={(v) => patchExtra({ largerTouchTargets: v })}
              />
              <ToggleRow
                label={t.haptics}
                value={extra.haptics}
                onChange={(v) => patchExtra({ haptics: v })}
                isLast
              />
            </Section>
            <FootNote text={t.a11yNote} />
          </>
        )}

        {category === "notifications" && (
          <>
            <Section>
              <ToggleRow
                label={t.pushEnabled}
                value={extra.pushEnabled}
                onChange={(v) => patchExtra({ pushEnabled: v })}
              />
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
              />
              <PickerRow
                label={t.notifSound}
                value={notifSoundLabel}
                onTap={() => setPicker("notifSound")}
                isLast
              />
            </Section>
            <FootNote text={t.notifNote} />
          </>
        )}

        {category === "sync" && (
          <>
            <Section>
              <ToggleRow
                label={t.cloudSync}
                value={extra.cloudSync}
                onChange={(v) => patchExtra({ cloudSync: v })}
              />
              <ToggleRow
                label={t.wifiOnly}
                value={extra.wifiOnly}
                onChange={(v) => patchExtra({ wifiOnly: v })}
              />
              <ValueRow label={t.lastSynced} value={t.lastSyncedValue} />
              <ActionRow
                icon={<UploadCloud size={18} />}
                label={t.backupNow}
                actionLabel={t.run}
                onAction={() => setToast(t.backedUp)}
                isLast
              />
            </Section>
            <FootNote text={t.syncNote} />
          </>
        )}

        {category === "privacy" && (
          <Section>
            <ToggleRow
              label={t.appLock}
              value={extra.appLock}
              onChange={(v) => patchExtra({ appLock: v })}
            />
            <ToggleRow
              label={t.hideInAppSwitcher}
              value={extra.hideInAppSwitcher}
              onChange={(v) => patchExtra({ hideInAppSwitcher: v })}
            />
            <ActionRow
              icon={<Trash2 size={18} />}
              label={t.clearSearchHistory}
              actionLabel={t.clear}
              onAction={() => setToast(t.cleared)}
            />
            <NavRow
              icon={<Download size={18} />}
              label={t.exportData}
              onTap={() =>
                setInfo({ title: t.exportTitle, body: t.exportBody })
              }
              isLast
            />
          </Section>
        )}

        {category === "about" && (
          <>
            <Section>
              <ValueRow label={t.version} value="prototype-v0.0.1" />
              <NavRow
                icon={<FileText size={18} />}
                label={t.license}
                onTap={() => setInfo({ title: t.license, body: t.licenseBody })}
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
                onTap={() =>
                  setInfo({ title: t.aboutProto, body: t.aboutBody })
                }
                isLast
              />
            </Section>
            <Section>
              <DangerRow
                icon={<Trash2 size={18} />}
                label={t.mockReset}
                onTap={() => setShowReset(true)}
                isLast
              />
            </Section>
          </>
        )}
      </main>

      <Drawer open={sidebarOpen} onClose={closeSidebar} title={t.title}>
        <nav className="flex-1 overflow-y-auto py-2" aria-label={t.title}>
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <CategoryNavItem
                key={c.id}
                icon={<Icon size={18} />}
                label={t[c.labelKey]}
                active={category === c.id}
                onTap={() => {
                  setCategory(c.id);
                  closeSidebar();
                }}
              />
            );
          })}
          <div
            className="mx-3 my-2"
            style={{ borderTop: `1px solid ${C.surface1}` }}
          />
          <CategoryNavItem
            icon={<Search size={18} />}
            label={t.crossSearch}
            active={false}
            onTap={() => {
              closeSidebar();
              nav("/cross-search");
            }}
          />
          <CategoryNavItem
            icon={<Trash2 size={18} />}
            label={t.trash}
            active={false}
            badge={trashCount > 0 ? String(trashCount) : undefined}
            onTap={() => {
              closeSidebar();
              nav("/trash");
            }}
          />
        </nav>
      </Drawer>

      <RadioSheet
        open={picker === "theme"}
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
      <RadioSheet
        open={picker === "lang"}
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
      <RadioSheet
        open={picker === "startup"}
        title={t.startup}
        options={[
          { id: "schedule", label: t.startupSchedule },
          { id: "work", label: t.startupWork },
          { id: "materials", label: t.startupMaterials },
        ]}
        value={extra.startupSection}
        onPick={(v) => {
          patchExtra({ startupSection: v as StartupSection });
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <RadioSheet
        open={picker === "notifSound"}
        title={t.notifSound}
        options={[
          { id: "none", label: t.soundNone },
          { id: "default", label: t.soundDefault },
          { id: "chime", label: t.soundChime },
        ]}
        value={extra.notifSound}
        onPick={(v) => {
          patchExtra({ notifSound: v as NotifSound });
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />

      {showReset && (
        <ConfirmModal
          title={t.confirmResetTitle}
          message={t.confirmResetMsg}
          danger
          coolDownMs={1000}
          confirmLabel={t.run}
          cancelLabel={t.cancel}
          onCancel={() => setShowReset(false)}
          onConfirm={() => {
            setShowReset(false);
            resetAll();
          }}
        />
      )}
      {showSignOut && (
        <ConfirmModal
          title={t.signOutTitle}
          danger
          confirmLabel={t.signOut}
          cancelLabel={t.cancel}
          onCancel={() => setShowSignOut(false)}
          onConfirm={() => {
            setShowSignOut(false);
            setToast(t.signedOut);
          }}
        />
      )}
      {info && (
        <InfoModal
          title={info.title}
          body={info.body}
          closeLabel={t.close}
          onClose={() => setInfo(null)}
        />
      )}
      {toast && (
        <div className="absolute inset-x-0 bottom-20 flex justify-center pointer-events-none">
          <div
            role="status"
            aria-live="polite"
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

function CategoryNavItem({
  icon,
  label,
  active,
  badge,
  onTap,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: string;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-current={active ? "page" : undefined}
      className="w-full min-h-[44px] px-4 py-2 flex items-center gap-3 text-left active:bg-white/5"
      style={{
        color: active ? C.mauve : C.text,
        background: active ? C.surface0 : undefined,
        fontWeight: active ? 600 : 400,
      }}
    >
      <span style={{ color: active ? C.mauve : C.subtext1 }}>{icon}</span>
      <span className="text-sm flex-1">{label}</span>
      {badge && (
        <span
          className="text-[10px] px-2 py-0.5 rounded-full"
          style={{ background: C.mauve, color: C.base, fontWeight: 600 }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <div
        className="mx-4 rounded-xl overflow-hidden"
        style={{ background: C.surface0 }}
      >
        {children}
      </div>
    </section>
  );
}

function FootNote({ text }: { text: string }) {
  return (
    <div
      className="mx-4 -mt-2 mb-4 px-3 py-2 rounded-md flex items-center gap-2 text-[11px]"
      style={{ background: C.surface0, color: C.subtext0 }}
    >
      <Info size={12} />
      {text}
    </div>
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
        aria-label={label}
        aria-valuetext={`${draft}px`}
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
        role="radiogroup"
        aria-label={label}
        className="grid grid-cols-2 rounded-md overflow-hidden"
        style={{ background: C.surface1 }}
      >
        {options.map((o) => {
          const active = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={active}
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

function ColorRow({
  label,
  value,
  options,
  onChange,
  isLast,
}: {
  label: string;
  value: string;
  options: { id: string; label: string; color: string }[];
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
        role="radiogroup"
        aria-label={label}
        className="flex items-center gap-2"
      >
        {options.map((o) => {
          const active = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={o.label}
              onClick={() => onChange(o.id)}
              className="grid place-items-center rounded-full"
              style={{
                width: 28,
                height: 28,
                background: o.color,
                outline: active ? `2px solid ${C.text}` : "none",
                outlineOffset: 2,
              }}
            >
              {active && <Check size={14} color={C.base} />}
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
      role="switch"
      aria-checked={value}
      aria-label={label}
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
        className="text-xs px-3 py-1 rounded-md min-h-[32px]"
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
  open,
  title,
  options,
  value,
  onPick,
  onClose,
}: {
  open: boolean;
  title: string;
  options: { id: string; label: string }[];
  value: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title} snapPoints={[0.5]}>
      <div role="radiogroup" aria-label={title} className="flex flex-col pb-2">
        {options.map((o) => {
          const active = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onPick(o.id)}
              className="min-h-[48px] px-4 flex items-center gap-3 text-left"
              style={{
                borderBottom: `1px solid ${C.surface1}`,
                color: C.text,
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
    </BottomSheet>
  );
}

function ConfirmModal({
  title,
  message,
  danger,
  coolDownMs,
  confirmLabel,
  cancelLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  message?: string;
  danger?: boolean;
  coolDownMs?: number;
  confirmLabel: string;
  cancelLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(!coolDownMs);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (coolDownMs) {
      const id = window.setTimeout(() => setArmed(true), coolDownMs);
      return () => clearTimeout(id);
    }
  }, [coolDownMs]);
  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <>
      <button
        type="button"
        onClick={onCancel}
        aria-label={cancelLabel}
        className="fixed inset-0 z-[90]"
        style={{ background: C.crust, opacity: 0.7 }}
      />
      <div className="fixed inset-0 z-[91] flex items-center justify-center p-4 pointer-events-none">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          className="w-full max-w-xs rounded-2xl p-4 flex flex-col gap-3 pointer-events-auto outline-none"
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
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!armed}
              className="h-10 rounded-md text-sm font-medium disabled:opacity-50"
              style={{ background: danger ? C.red : C.mauve, color: C.base }}
            >
              {armed ? confirmLabel : "..."}
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
  closeLabel,
  onClose,
}: {
  title: string;
  body: string;
  closeLabel: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="fixed inset-0 z-[90]"
        style={{ background: C.crust, opacity: 0.5 }}
      />
      <div className="fixed inset-0 z-[91] flex items-center justify-center p-4 pointer-events-none">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          className="w-full max-w-xs rounded-2xl p-4 flex flex-col gap-3 pointer-events-auto outline-none"
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
              aria-label={closeLabel}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center"
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
