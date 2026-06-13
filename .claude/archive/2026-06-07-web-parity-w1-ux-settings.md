---
Status: COMPLETED
Created: 2026-06-07
Completed: 2026-06-10 (PR #63 merged + 統合修復 PR #66)
Branch: feat/w1-settings-theme
Owner-chat: main
Parent: ./2026-06-07-web-desktop-parity-roadmap.md
---

# Plan: W1 — UX 基盤（Theme / FontSize / Language / Settings 画面 / ShortcutConfig）

> 親ロードマップ `2026-06-07-web-desktop-parity-roadmap.md` の **W1**。web を Desktop 同等へ引き上げる横断レーンの最初の実装。
> role-pm 調査（2026-06-07）で「W1 の本体は設定画面の移植ではなく、**web に Theme 基盤を新設**すること」と判明。

---

## Context

- **動機**: web には現状 Theme/FontSize 切替が**一切無い**（`data-theme` 属性も font-size 適用も Provider も無い）。i18n provider だけ W0 で入った。W1 で shared 層に Theme/FontSize/Language/Shortcut 基盤 + Settings 画面を新設し、3 配布形態（Electron/Web/Capacitor）が共用できる形にする。
- **制約**:
  - コスト $0（Theme/Shortcut/Language は localStorage 永続化。DB 変更ゼロ。新テーブル不要）
  - frontend/ は参照元（読むだけ・Tauri 依存・破棄予定）。**コピペ不可**（`useTheme()`/`useTranslation()` 直呼びは W0 規約違反 → props/DI 注入で書き直し）
  - notion-\* トークン厳守（ハードコード禁止・不透明背景）。i18n は props 経由（フック内 `useTranslation` 禁止）。DataService はコールバック注入。Pattern A。Mobile 省略 Provider は Optional バリアント（CLAUDE.md §6.2-6.4）
  - 既存 lean UI（Tasks/Daily/Notes/Schedule/WikiTags）を壊さない。MainScreen の section 分岐・Provider nesting に settings を足すだけ
- **Non-goals**:
  - **既存 view の ja 化**（ユーザー確定: 新規移植分のみ i18n-first。既存 lean view の英語ハードコード ja 化は別タスク）
  - **Web 不要項目**: auto-launch / tray / global-shortcut / MCP tools list（Electron 専用 → 除外）
  - editor 系 Theme 項目（editorFontSize/Family/LineHeight/Padding）は web Notes editor が CSS 変数対応なら含め、不要なら ThemeContextValue から落とす（実装時に Notes 現状を見て判断）
  - W2（Trash / CommandPalette）は別 PR

---

## Scope (Touchable Paths)

```
shared/src/context/**          # Theme / ShortcutConfig (Pattern A 3ファイル)
shared/src/hooks/**            # useLocalStorage / useThemeContext / useShortcutConfig
shared/src/types/**            # shortcut 型
shared/src/constants/**        # defaultShortcuts (web 用に選別)
shared/src/components/**       # SettingsAppearance / SettingsLanguage / SettingsShortcuts (props 注入の純粋部品)
shared/src/index.ts            # barrel export
web/src/**                     # ThemeProvider マウント / SettingsScreen / MainScreen に settings section
.claude/docs/vision/plans/2026-06-07-web-parity-w1-ux-settings.md
```

**対象外**: frontend/（参照のみ・改変禁止）/ supabase/（DB 変更なし）/ desktop/ mobile/（未作成）/ 他チャット worktree。

---

## Steps

| #   | Step                                                                                 | Gate       | Acceptance                                              |
| --- | ------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------- |
| 1   | `useLocalStorage` を shared へ移植（Theme/Shortcut の永続化土台）                    | 🤖 自律    | `cd shared && npm run build` exit 0                     |
| 2   | Theme を shared へ（Pattern A 3ファイル）+ web 用に縮小・shared i18n に結線          | 🤖 自律    | `cd shared && npm run build` exit 0 / vitest 緑         |
| 3   | web で ThemeProvider マウント + `data-theme`/font-size を documentElement に適用     | 🤖→👀 目視 | dark/light トグルで色が変わる・font-size 12-25px が追従 |
| 4   | Appearance/Language 設定部品を shared へ（Theme は props 注入・i18n は props 注入）  | 🤖 自律    | `cd shared && npm run build` exit 0 / 単体描画          |
| 5   | Shortcut 型/default を web 用 ID に選別して shared へ                                | 🤖 自律    | `cd shared && npm run build` exit 0                     |
| 6   | ShortcutConfig Context（Optional バリアント込み）を shared へ・localStorage 永続化   | 🤖 自律    | リロードで shortcut 設定が保持                          |
| 7   | KeyboardShortcuts 部品（選別版・最小: 一覧+リバインド+conflict+reset）を shared へ   | 🤖→👀 目視 | リバインド→conflict 検出→reset が機能                   |
| 8   | web に SettingsScreen（レスポンシブ単一）新規 + MainScreen に settings section + nav | 🤖→👀 目視 | nav から Settings を開き全項目表示                      |
| 9   | barrel export 整理 + 最終ビルド/lint                                                 | 🤖 自律    | shared/web build exit 0 / web lint clean                |

### Gate 凡例

- 🤖 自律 = Claude 完結（型/test で品質担保）/ 👀 目視 = ユーザーが画面確認 / 🛑 人手 = DDL push 等（W1 には無し）

---

## Acceptance Criteria (機械検証可能)

- [ ] `cd shared && npm run build`（tsc -b）exit 0
- [ ] `cd shared && npm run test`（vitest）緑（移植フック/部品のテストがあれば）
- [ ] `cd web && npm run build` exit 0
- [ ] `cd web && npm run lint` clean
- [ ] PR diff が機能追加スコープ内（目安 +800 行程度・新規移植のため上振れ許容）
- [ ] **目視**: dark/light トグルで `data-theme` 切替・全画面の色が変わる
- [ ] **目視**: font-size スライダ10段階で `documentElement.style.fontSize` が 12-25px に追従
- [ ] **目視**: en/ja トグルで **新規移植分（Settings 画面）** の文言が切替
- [ ] **目視**: リロード後も theme/fontSize/language/shortcut が localStorage から復元
- [ ] **目視**: shortcut リバインド→conflict 検出→reset が機能

---

## DB Migration Notes

**不要**。Theme/Shortcut/Language は全て localStorage 永続化（frontend と同方式）。新テーブル/カラムなし。

---

## Risks / Known Issues 参照

1. **TrashView/Settings は legacy 依存で流用不可**（W2 含む最大の罠）。frontend の `useNoteContext`/`useDailyContext` は DU-G で削除済。**書き直し前提**。
2. **AppearanceSettings/LanguageSettings は `useTheme()`/`useTranslation()` 直呼び** = W0 規約違反。shared 移植時に **Theme を props 注入・i18n を props 注入**へ。
3. **Shortcut ID の web 不適合**: terminal/sidebar/right-sidebar/work-timer/cal/tree 等 web に section/機能が無い ID が多数。**選別必須**（全コピーで死にコマンド回避）。
4. **Mobile Optional Provider**: ShortcutConfig は Mobile 省略 → `createOptionalContextHook` で Optional バリアント必須。
5. **worktree build 誤報**: worktree は `node_modules/dotenv` 非共有。env 無し build で supabase `createClient` が誤 tree-shake され「本番ログイン不動」と誤判定された前例（memory `worktree_supabase_treeshake`, 2026-06-07）。build 検証は env を整えた上で・型エラーの有無で判断する。
6. **SyncProvider は最外で1回マウント済み**（Realtime channel 再接続回避）→ settings section もこの内側に置く。各 view の Provider 構成は触らない。
7. **notion-\* トークン**: `text-white` 等のハードコード気味クラスはトークン化を検討（未定義クラスは silent fail で透明落ち）。

---

## References

- 親ロードマップ: `.claude/docs/vision/plans/2026-06-07-web-desktop-parity-roadmap.md`
- 移行 SSOT: `.claude/2026-05-04-cross-platform-migration.md`
- coding-principles §6（2層モデル）/ CLAUDE.md §6.2-6.4
- W1 参照元（読むだけ）:
  - `frontend/src/context/ThemeContext.tsx` / `ThemeContextValue.ts`
  - `frontend/src/components/Settings/AppearanceSettings.tsx` / `LanguageSettings.tsx` / `Settings.tsx` / `KeyboardShortcuts.tsx`
  - `frontend/src/context/ShortcutConfigContext.tsx` / `types/shortcut.ts` / `constants/defaultShortcuts.ts`
- related skills: `add-component`, `frontend-react-designer`, `test-writing`

---

## Worklog

- 2026-06-07: role-pm 調査で要件分解。web に Theme 基盤が無いことが判明（W1 の本体）。i18n は新規移植分のみ i18n-first（ユーザー確定）。worktree `w1-ux-settings` / branch `feat/w1-settings-theme` を origin/main `3f67082` から作成。
- 2026-06-08: 実装をバッチA（Theme コア・Step1-4）/ バッチB（Shortcut + SettingsScreen・Step5-8）の2段で role-engineer に委譲（socket hang up 対策で稼働短縮）。検証ブロック要因 = 本体 `shared/`・`web/` node_modules に W0 deps（i18next/react-i18next/lucide-react/jsdom/@testing-library 等）が未インストールだった（worktree は node_modules を本体からリンク）。本体で `npm install` 実行して解消。
  - **検証実測**: shared build (tsc -b) exit 0 / web build (tsc -b + vite build) exit 0 / shared test 332 passed (29 files) / web lint 0 errors（既存 warning 1件=変更外 `DebouncedTextInput.tsx`）。
  - **role-qa 独立監査 = PASS with concerns**（Critical/High 0）。Shortcut ID 選別10件（nav は web section に再キー）/ Optional バリアント / props 注入純粋部品 / Provider 順序 §6.2 整合 を確認。
  - **Low #1 修正取込**: `SettingsAppearance.tsx` の range slider accent を `--notion-accent`（未定義）→ `--color-notion-accent`（実在トークン）に修正。
  - **申し送り（W2 へ）**: ⚠️ Shortcut は現状「設定・リバインド・conflict・reset はできるが、グローバル keydown executor が無く押下しても実行されない」。Step 7 で実行配線はスコープ外と定義済（要件違反ではない）。**W2 で `useGlobalShortcuts(matchEvent, setSection, undo, redo, openPalette)` を MainScreen にマウントして実行配線する**。`global:command-palette` は W2 の CommandPalette UI と同時に配線。
  - **残 Low（別バッチ可・非ブロッキング）**: `text-white` ハードコード（accent 上のオン文字トークン化）/ `FONT_SIZE_PX` マップの ThemeContext↔SettingsAppearance 重複を `constants/` へ一元化。
  - **👀 ユーザー実機目視 待ち**: dark/light 発色 / font-size 10段 12-25px 追従 / en/ja トグルで Settings 文言切替 / リロード後の theme/fontSize/language/shortcut 復元 / shortcut rebind→conflict→reset。
