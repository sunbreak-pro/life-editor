---
Status: Draft
Created: 2026-05-24
Branch: prototype/mobile-ui
Owner-chat: chat-main
Parent: .claude/docs/vision/plans/01_要件定義書_プロトタイプ環境.md
Previous: .claude/docs/vision/plans/05_要件定義書_Materials.md
---

# Plan: Settings 画面 要件定義 (Prototype Mobile)

> 段階 A — 「何を作るか」を確定する書類。UIUX (10) と CRUD (11) は本書を Parent とする。03/04/05 のデータモデル合意を継承し、横断機能 (横断検索 / Trash / 通知) のハブを担う。

---

## Context

- **動機**: prototype の Settings 画面は \_artifacts に存在しない新規設計。Theme / FontSize / Language / Notifications / Trash / About を載せ、Trash と横断検索のエントリポイントを担う。本書では Sync を除外する判断 (1 周目 Q4) を反映
- **制約**: 1 ファイル TSX 維持 / Provider 不使用 / Catppuccin Mocha 固定 / localStorage 名前空間 `lifemobile-mock:*` のみ例外許可 / モバイル Optional Provider (Sync / Audio / Shortcut 等) は範囲外
- **Non-goals**: Sync 設定 / Audio Mixer / Shortcut Config / ScreenLock / FileExplorer 設定 (Mobile 省略 Provider 領域) / 実通知 / OAuth ログイン

---

## Scope (Touchable Paths)

```
.claude/docs/vision/plans/06_要件定義書_Settings.md           (本書)
prototype/src/screens/SettingsScreen.tsx                      (将来の実装対象、未作成)
prototype/src/screens/TrashScreen.tsx                         (Settings から起動、未作成)
prototype/src/screens/CrossSearchScreen.tsx                   (Tag 起点の横断ビュー、未作成)
prototype/src/App.tsx                                         (`/settings` ルート追加、CRUD 11 で対応)
```

---

## 1. データモデル合意

03/04/05 で確定した型に加え、Settings 専用の永続化キーを定義:

```ts
type ThemeMode = "light" | "dark" | "system";
type Language = "ja" | "en";
type NotificationKind =
  | "pomodoroSessionEnd"
  | "scheduleReminder10min"
  | "scheduleReminder30min"
  | "dailyUnwritten";

interface AppSettings {
  themeMode: ThemeMode; // default 'dark'
  fontSize: number; // default 16 (range 12-25, step 1)
  language: Language; // default 'ja'
  notifications: Record<NotificationKind, boolean>;
  // 表示・操作系
  layoutDefaults: {
    materialsLayout: "card" | "list"; // Materials 05 §FR-3 と共有
  };
  // メタ
  updatedAt: number;
}
```

**重要な統合決定**:

- `ThemeMode` / `fontSize` は UI で **state は保存するが、見た目には反映しない** (1 周目 Q4 Recommended)。「本番で適用される予定」バッジ表示
- `Sync` 関連の項目・型は **本書では定義しない**
- `Trash` の対象は ScheduleItem / Note / Daily / PomodoroPreset / TimerSession の全エンティティ (各画面の soft delete を共通 UI で復元)

---

## 2. 機能要件 (FR)

### FR-1: Settings トップ (List Section)

`/settings` ルート。iOS 風の List Section レイアウト。以下のセクションを縦に並べる。

#### Section 1: 表示

- **Theme**: `ThemeMode` 選択 (Light / Dark / System) — Radio 風 row
- **Font size**: スライダー 12-25 (10 段階) + 現在値表示
- **Language**: 日本語 / English — Picker row
- **Materials の既定表示**: Card / Row — segmented

#### Section 2: 通知

- **Pomodoro セッション終了**: toggle
- **予定 10 分前リマインダー**: toggle
- **予定 30 分前リマインダー**: toggle
- **Daily 未記入 (20:00)**: toggle

各 toggle は ON でも実通知は出さない (NFR-2 参照)。

#### Section 3: データ

- **横断検索**: 「→ 開く」row → CrossSearchScreen 起動
- **ゴミ箱**: 「→ 開く」row + バッジ (soft delete 件数) → TrashScreen 起動
- **Mock データを初期化**: dangerous action (赤系)、確認モーダル → localStorage 全削除 → リロード

#### Section 4: About

- **バージョン**: `prototype-v0.0.1` 表示
- **OSS ライセンス**: Modal 起動 (mock: テキストのみ)
- **本番リポジトリへのリンク**: GitHub URL コピー row (alert)
- **このプロトタイプについて**: ヘルプテキスト modal

### FR-2: TrashScreen (Settings 経由)

- 上部タブ: 全て / Schedule / Notes / Daily / Pomodoro Preset / Timer Session
- 行: title / 削除日時 (`deletedAt` の `timeAgo`) / 「復元」「完全削除」ボタン
- **復元**: `isDeleted=false` + `deletedAt=undefined` で復元 (タイトル重複は警告のみ、許容)
- **完全削除**: 物理削除 (localStorage から remove) + 確認モーダル
- **全削除**: ヘッダー右上 → 確認モーダル → 全 isDeleted=true なものを物理削除
- 空状態: イラスト風アイコン + 「ゴミ箱は空です」

### FR-3: CrossSearchScreen (横断検索)

- 起動経路:
  1. Settings → 横断検索 row
  2. 各画面の WikiTag chip タップ (03/04/05 各 FR で言及)
  3. Materials Editor の `[[title]]` リンク不可状態のヘルプ (任意、将来)
- 上部: 検索クエリ入力 (placeholder "タグ名・タイトル・本文")
- 上部 chip 列: 起動時のタグ (preset) や追加タグを表示 (× で削除)
- 結果: ScheduleItem / Note / Daily を時系列降順 (`updatedAt`) で混在表示
- 行の左に kind アイコン (Calendar / FileText / BookOpen)、右に WikiTag chip 群
- 行タップ → 該当画面へ遷移 + ハイライト (Materials なら Editor を直接開く)

### FR-4: 設定の永続化と適用

- すべての `AppSettings` 変更は localStorage に即時同期
- リロード後、AppSettings から initial state を復元
- `themeMode` / `fontSize` は UI に **見た目では反映しない** (state のみ保存、Catppuccin Mocha 固定)
- `language` は UI 上の表示文字列を切替 (簡易実装: 各画面の文字列を 2 言語分用意した `t()` 関数で参照)
- `layoutDefaults.materialsLayout` は Materials 起動時の初期値として読まれる

### FR-5: BottomTabBar (Settings タブが active)

03 §FR-8 と同じ (4 タブ全 enabled)。

---

## 3. 非機能要件 (NFR)

### NFR-1: 設定変更応答

- toggle / slider / radio の変更は 16ms 以内に画面反映 + localStorage 同期

### NFR-2: 通知の実体

- 通知 toggle が ON でも、トリガー時の挙動は **console.log + Toast 表示** のみ
- Web Notifications API は使わない
- 「これは本番モバイルアプリで実通知になります」バッジを Section 2 に常時表示

### NFR-3: i18n

- `language='ja'|'en'` 切替で UI 文字列が切り替わる範囲は **Settings 画面のみ** (プロトタイプ範囲)
- Schedule / Work / Materials は ja 固定 (本番で `react-i18next` 化する前提、本書 §9 マッピング)
- 簡易 t 関数: `const t = (key, en, ja) => language === 'en' ? en : ja;`

### NFR-4: 想定解像度・操作

- Schedule 03 NFR-3 と同じ

---

## 4. 不変要件 (Invariants)

新規画面のため「維持」要件はなし。本書で定義する要件:

- **[S-LIST-1] iOS 風 List Section**: row 高さ 44px 以上、divider hairline (1px の border)、section header はキャピタル小文字 + 余白
- **[S-DANGER-1] 危険操作の色**: 「Mock 初期化」「完全削除」「全削除」は `C.red` 系を使い、確認モーダル必須
- **[S-TRASH-1] Trash の表示順**: `deletedAt` 降順 (新しい削除が上)
- **[S-CROSS-1] CrossSearch の選択タグ chip**: スクロールできる横並び、× で removable
- **[S-PREVIEW-1] Theme/FontSize の「本番で適用」バッジ**: 該当 row の右側に常時表示

---

## 5. 画面遷移

```
/settings
  ├─ SettingsScreen (List Section)
  │    ├─ Section 1: 表示 (Theme/FontSize/Language/Materials Layout)
  │    ├─ Section 2: 通知 (4 toggle)
  │    ├─ Section 3: データ
  │    │    ├─ 横断検索 → CrossSearchScreen
  │    │    ├─ ゴミ箱 → TrashScreen
  │    │    └─ Mock 初期化 → ConfirmModal → reset
  │    └─ Section 4: About
  ├─ TrashScreen
  │    ├─ 上部タブ (全て/Schedule/Notes/Daily/Preset/Session)
  │    ├─ 復元 → 元画面に反映 (in-memory)
  │    ├─ 完全削除 → 確認 → 物理削除
  │    └─ 全削除 → 確認 → 物理削除
  └─ CrossSearchScreen
       ├─ 検索 input + chip 列
       └─ 結果行タップ → 該当画面へ遷移 (/schedule, /materials, etc.)
```

---

## 6. データシード (mock data 初期値)

CRUD 11 で `prototype/src/data/seed.ts` に集約。Settings 関連:

| データ      | 件数          | 内容                                                                                  |
| ----------- | ------------- | ------------------------------------------------------------------------------------- |
| AppSettings | 1 (singleton) | themeMode='dark' / fontSize=16 / language='ja' / 全通知=true / materialsLayout='card' |

Trash 画面の初期状態は空 (各画面で削除した結果が累積)。

---

## 7. CRUD 操作一覧 (CRUD 計画書 11 への要件)

| Op                             | 対象                                                       | トリガー               | 保存先                                               |
| ------------------------------ | ---------------------------------------------------------- | ---------------------- | ---------------------------------------------------- |
| `setTheme`                     | AppSettings.themeMode                                      | Radio 選択             | localStorage                                         |
| `setFontSize`                  | AppSettings.fontSize                                       | Slider                 | localStorage (throttle 100ms)                        |
| `setLanguage`                  | AppSettings.language                                       | Picker                 | localStorage                                         |
| `setMaterialsLayoutDefault`    | AppSettings.layoutDefaults.materialsLayout                 | Segmented              | localStorage                                         |
| `setNotification`              | AppSettings.notifications[kind]                            | Toggle                 | localStorage                                         |
| `resetMockData`                | (全 localStorage)                                          | Mock 初期化 + 確認     | localStorage clear + reload                          |
| `listTrashItems`               | (ScheduleItem \| Note \| PomodoroPreset \| TimerSession)[] | TrashScreen mount      | UI 派生 (各画面 store を `isDeleted=true` で filter) |
| `restoreTrashItem`             | EntityId                                                   | 復元ボタン             | inline update (`isDeleted=false`)                    |
| `purgeTrashItem`               | EntityId                                                   | 完全削除ボタン         | localStorage 物理削除                                |
| `purgeAllTrash`                | (全 isDeleted=true)                                        | 全削除ボタン           | localStorage 物理削除                                |
| `crossSearch(query, tagIds[])` | (ScheduleItem \| Note)[]                                   | CrossSearchScreen 入力 | UI 派生                                              |

---

## 8. Acceptance Criteria (本書の完了条件)

- [ ] §1 のデータモデル (AppSettings) が 03/04/05/11 と矛盾しない
- [ ] §2 機能要件で Sync が含まれていない (Q4 回答準拠)
- [ ] §4 不変要件で iOS 風 List / 危険色 / Trash 表示順を明示
- [ ] §7 CRUD 操作が 11 計画書の入力として十分
- [ ] §9 本番移植マッピングが具体的

---

## 9. 本番移植マッピング (Production Port Mapping)

### 9.1 ファイル対応

| Prototype                                               | 本番 `frontend/`                                                 | 備考                                                                          |
| ------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `prototype/src/screens/SettingsScreen.tsx` (1 ファイル) | `frontend/src/components/Mobile/MobileSettingsView.tsx`          | Desktop 版 `frontend/src/components/Settings/` と共通化可能な部分は shared 化 |
| `prototype/src/screens/TrashScreen.tsx`                 | `frontend/src/components/Trash/MobileTrashView.tsx`              | 既存 TrashView があれば mobile 派生として                                     |
| `prototype/src/screens/CrossSearchScreen.tsx`           | `frontend/src/components/Search/CrossSearchView.tsx` 新規        | 横断検索は本番でも新規追加 (現状 frontend/ に未実装)                          |
| `mockStore.settings`                                    | `frontend/src/services/getDataService().getSettings/setSettings` | Supabase の `user_settings` テーブル (本番で追加要)                           |

### 9.2 型対応

| Prototype 型       | 本番型                                                                      | 差分                                                                 |
| ------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `AppSettings`      | `frontend/src/types/appSettings.ts` 新規 or 既存 ThemeContext + i18n の合成 | 本番では Theme / i18n / Notifications で Context が別 → 統合せず参照 |
| `NotificationKind` | 既存 enum or 新規                                                           | Capacitor LocalNotifications API 連携時に id 体系を揃える            |

### 9.3 配色対応

Schedule 03 §9.3 と同じ。`C.red` → `notion-danger` 系トークン。

### 9.4 移植時の注意

- 本番 Settings は Desktop で既に Theme / FontSize / Language 実装あり (`frontend/src/context/ThemeContext.tsx` 等)。Mobile 版は **同じ store / context を参照** する形にする (Mobile 専用設定値を作らない)
- Trash の対象テーブル一覧は CLAUDE.md §4.4 に従う (Tasks / Notes / Dailies / Routines / Databases / Templates)
- 横断検索は本番では `frontend/src/services/searchService.ts` を新規作成、Supabase の `LIKE` クエリ or 全文検索 (pg_trgm) を活用
- 通知は本番 Capacitor 化時に `@capacitor/local-notifications` で実通知に格上げ。本書の `NotificationKind` をそのままトリガー id に使える

### 9.5 移植時に **持ち込まない** もの

- localStorage 永続化レイヤ
- 「本番で適用」バッジ (本番では適用されているため不要)
- `Mock 初期化` row
- 簡易 t 関数 → 本番では `react-i18next` の `useTranslation()` に置換

---

## Risks / Known Issues 参照

- `.claude/docs/known-issues/INDEX.md` を grep:
  - i18n / 翻訳キー欠落
  - 設定変更の race condition (slider の rapid update)
- 新規 known issue 候補:
  - Trash 復元時の title 重複 (Daily の `daily-YYYY-MM-DD` ID 衝突)
  - 横断検索で大量の Note を走査する際のレンダリング負荷 (mock では小規模)
  - Theme/FontSize が UI に反映されない件についてユーザーに誤解されないバッジ運用

---

## References

- 親計画書: `01_要件定義書_プロトタイプ環境.md`
- 前計画書 (データモデル合意元): `03_要件定義書_Schedule.md` / `04_要件定義書_Work.md` / `05_要件定義書_Materials.md`
- CLAUDE.md §4.4 (ソフトデリート対象) / §6.6 (i18n) / §8 Tier 2 (Theme/i18n/Trash 関連)
- 本書を参照する後続: `10_UIUX設計書_Settings.md` / `11_実装計画書_CRUDモック.md`

---

## Worklog

- 2026-05-24: 初版。Sync 除外 / Theme/FontSize は state のみ保存 (見た目固定) / Trash の対象範囲を全エンティティに / 横断検索のハブとして Settings を位置付け
