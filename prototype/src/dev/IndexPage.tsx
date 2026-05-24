import { Link } from "react-router-dom";

const C = {
  base: "#1e1e2e",
  mantle: "#181825",
  surface0: "#313244",
  surface1: "#45475a",
  text: "#cdd6f4",
  subtext0: "#a6adc8",
  mauve: "#cba6f7",
  blue: "#89b4fa",
  green: "#a6e3a1",
  peach: "#fab387",
} as const;

type Entry = {
  to: string;
  label: string;
  desc: string;
  accent: string;
};

const ENTRIES: Entry[] = [
  {
    to: "/schedule",
    label: "Schedule",
    desc: "Month/Three/List ビュー + ScheduleItem 統合型 + WikiTag",
    accent: C.mauve,
  },
  {
    to: "/work",
    label: "Work",
    desc: "Pomodoro Timer / History / Preset 設定 (Schedule task と統合)",
    accent: C.blue,
  },
  {
    to: "/materials",
    label: "Materials",
    desc: "Notes / Daily + WikiTag + [[link]] + Backlink",
    accent: C.green,
  },
  {
    to: "/settings",
    label: "Settings",
    desc: "Theme / FontSize / Language / Notifications / Mock 初期化",
    accent: C.peach,
  },
  {
    to: "/trash",
    label: "Trash",
    desc: "全エンティティのソフト削除 → 復元 / 完全削除",
    accent: C.subtext0,
  },
  {
    to: "/cross-search",
    label: "Cross Search",
    desc: "全エンティティ横断検索 (Tag 起点)",
    accent: C.mauve,
  },
];

export function IndexPage() {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-6"
      style={{ background: C.mantle, color: C.text }}
    >
      <div className="w-full max-w-md flex flex-col gap-5">
        <header className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            life-editor prototype
          </h1>
          <p className="text-xs mt-2" style={{ color: C.subtext0 }}>
            Phase 3 — 6 screens, mock CRUD (lifemobile-mock:*)
          </p>
        </header>

        <nav className="flex flex-col gap-3">
          {ENTRIES.map((e) => (
            <Link
              key={e.to}
              to={e.to}
              className="block rounded-2xl p-4 transition-colors active:scale-[0.99]"
              style={{
                background: C.surface0,
                borderLeft: `3px solid ${e.accent}`,
              }}
            >
              <div
                className="text-base font-medium"
                style={{ color: e.accent }}
              >
                {e.label}
              </div>
              <div
                className="text-xs mt-1 leading-relaxed"
                style={{ color: C.subtext0 }}
              >
                {e.desc}
              </div>
              <div
                className="text-[10px] mt-2 font-mono"
                style={{ color: C.subtext0, opacity: 0.7 }}
              >
                {e.to}
              </div>
            </Link>
          ))}
        </nav>

        <footer
          className="text-[11px] text-center leading-relaxed"
          style={{ color: C.subtext0, opacity: 0.75 }}
        >
          各画面は <span style={{ color: C.peach }}>375px (max-w-md)</span> 幅
          で独立起動。
          <br />
          iPhone Safari (同一 Wi-Fi) からは
          <code
            className="px-1 mx-1 rounded"
            style={{ background: C.surface1 }}
          >
            http://&lt;mac-ip&gt;:5173
          </code>
          。
        </footer>
      </div>
    </div>
  );
}
