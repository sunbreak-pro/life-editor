---
Status: Draft
Created: 2026-06-15
Branch: claude/web-app-ui-ux-plan-t7wa12
Owner-chat: web-app-ui-ux
Parent: ./2026-06-07-web-desktop-parity-roadmap.md
Previous: ./2026-06-07-web-parity-w4-analytics-connect.md
---

# Plan: Web/Mobile アプリシェル刷新（W5・サイドバー + レスポンシブ・Desktop 同等のナビ/レイアウト）

> 親ロードマップ `2026-06-07-web-desktop-parity-roadmap.md` の子計画書（W5）。
> W0〜W4 で各セクションの**機能コンテンツ**は lean に移植済み。本書はそれらを束ねる
> **アプリシェル（ナビゲーション/レイアウトの殻）**を Desktop 同等へ引き上げる。

---

## Context

- **動機**: Web の機能（Tasks / Daily / Notes / Schedule / Work / Connect / Analytics / Settings / Trash / Tags）は W0〜W4 で揃ったが、それらを束ねる**シェルが極端に貧弱**。`web/src/MainScreen.tsx` のナビは横並びテキストボタン列、レイアウトは `max-w-2xl` 中央1カラムのみ。旧 Desktop（`frontend/`）の折りたたみ/リサイズ式サイドバー＋3ペイン＋モバイル用ボトムタブと比べ、操作感・情報密度・回遊性が大きく不足している。
- **到達基準**: 操作感・情報密度の同等（`notion-*` で再構成。ピクセル一致は求めない。親書 Context 方針 2）。
- **制約**:
  - コスト $0 厳守（DDL なし・新規依存は無料枠 / 既存依存で完結させる）。
  - 既存の不変式を維持: DataService 境界（§3.1/§6.4・getDataService 注入）、Provider ネスト順（§6.2: Sync → Shortcut → Timer → Audio …）、section ルーティングは `useState` 切替で React Router 不使用（§3.2）。
  - 新規 UI は `shared/src/components/` に集約（§6・W0 案 A）。`notion-*` トークン厳守・主要 UI 背景に透明度禁止。i18n は props 注入（shared 内で `useTranslation()` 直呼び禁止）。
  - 既存 web lean UI（各セクションの中身）は壊さない。本書はシェルの殻の置換に徹する。
- **Non-goals**:
  - セクション**内部**の UX 密度向上（Tasks DnD 詳細 / Schedule カレンダー充実 / 右サイドパネル等）は本書では扱わない → W6+ の子計画書で段階展開。
  - `desktop/`（Electron 包装・Phase 3）/ `mobile/`（Capacitor 包装・Phase 4）自体の改変。本書は「shared 側のシェルを 3 包装が使える形に整える」までを担う。
  - Terminal / Materials(File Explorer) など Desktop 専用機能の Web 移植（親書 §棚卸しで対象外確定）。

---

## 中核設計：レスポンシブ単一の AppShell

2層モデル（親書）の「**単純画面 = レスポンシブ単一**」に従い、**1 つの `AppShell` コンポーネント**が画面幅で広幅/狭幅を切替える。複雑画面の Desktop/Mobile 分割はしない（シェルは単純画面）。

| 幅 | レイアウト | ナビ |
| --- | --- | --- |
| **広幅（≥ md）** | 左サイドバー + メインコンテンツの2カラム | `SidebarNav`: セクションアイコン+ラベル、折りたたみ可（アイコンのみ↔展開）、アクティブ強調、フッタに Cmd+K / ユーザー / サインアウト |
| **狭幅（< md）** | 単一カラム + 下部固定タブ | `BottomTabBar`: 主要セクション数個 + 「More」シート（`BottomSheet` で残りセクション）。`env(safe-area-inset-*)` 考慮 |

- 切替は軽量な `useMediaQuery` 相当フック（`shared/src/hooks/`）。SSR 不要のブラウザ環境前提で `matchMedia` ベース。
- **デザインシステム再利用**: 既存プリミティブ（`Button` / `IconButton` / `Modal` / `BottomSheet` / `Card`）を流用。シェル専用に `AppShell` / `SidebarNav` / `BottomTabBar` / `NavItem` を新設。
- **状態は MainScreen が保持**: `section` / `setSection` / `paletteOpen` / `session` は現状どおり `MainScreen` が持ち、`AppShell` には props（`sections` / `activeSection` / `onNavigate` / `onTogglePalette` / `userEmail` / `onSignOut` / ラベル resolver）で注入。`children` にセクション本体を流し込む。AppShell は純粋表示（DataService 非依存）。
- **Provider ネストは不変**: `SyncProvider → ShortcutConfigProvider → GlobalShortcuts → TimerProvider → AudioProvider` の現行ネスト（§6.2）はそのまま。`AppShell` は `AudioProvider` の内側、現行 header+nav+content の位置に挿入する。

---

## Scope (Touchable Paths)

```
shared/src/components/AppShell.tsx          ← 新設（レスポンシブ単一シェル）
shared/src/components/SidebarNav.tsx        ← 新設（広幅ナビ）
shared/src/components/BottomTabBar.tsx      ← 新設（狭幅ナビ）
shared/src/components/NavItem.tsx           ← 新設（ナビ項目プリミティブ）
shared/src/components/index.ts              ← barrel export 追加
shared/src/hooks/useMediaQuery.ts           ← 新設（matchMedia ラッパ）
shared/src/index.ts                         ← public barrel に useMediaQuery export 追加（hooks/index.ts barrel は未存在のため公開面の index.ts に直 export — 既存 useLocalStorage と同方式）
shared/tests/useMediaQuery.test.ts          ← 新設（Acceptance 必須テスト）
shared/tests/appShell.test.tsx              ← 新設（Acceptance 必須テスト）
shared/src/i18n/locales/en.json             ← 不足ナビラベル補完
shared/src/i18n/locales/ja.json             ← 不足ナビラベル補完
web/src/MainScreen.tsx                      ← 素朴 header+nav を AppShell へ差し替え
.claude/docs/vision/plans/2026-06-15-web-parity-w5-app-shell.md
.claude/docs/vision/plans/2026-06-07-web-desktop-parity-roadmap.md  ← W5 参照を1行追記
```

スコープ外の変更が必要になったら、本計画書を更新してから着手する（更新せず広げない）。

**対象外（明示）**: `frontend/`（FROZEN・参照のみ）/ `desktop/` / `mobile/` / 各セクション内部コンポーネント / `supabase/`（DDL なし）。

---

## Steps

| #   | Step                                                                                                 | Gate    | Acceptance                                                  |
| --- | ---------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------- |
| 1 ✅ | `useMediaQuery` フック新設（matchMedia ラッパ・SSR非依存）                                            | 🤖 自律 | `cd shared && npm run build` exit 0 / 単体 test 緑          |
| 2 ✅ | `NavItem` + `SidebarNav`（広幅・折りたたみ/アクティブ/フッタ。props 注入・`notion-*`）                | 🤖 自律 | `cd shared && npm run build` exit 0                          |
| 3 ✅ | `BottomTabBar` + More シート（狭幅・`BottomSheet` 流用・safe-area）                                   | 🤖 自律 | `cd shared && npm run build` exit 0                          |
| 4 ✅ | `AppShell`（`useMediaQuery` で 2/3 を出し分け・`children` にセクション流し込み）+ barrel export        | 🤖 自律 | `cd shared && npm run build` exit 0                          |
| 5 ✅ | i18n: 不足ナビラベル（折りたたみ/More/サインアウト等）を en/ja 両 catalog に追加                       | 🤖 自律 | 両ファイル同キー存在・`npm run build` exit 0                |
| 6 ✅ | `web/src/MainScreen.tsx` を `AppShell` へ差し替え（既存 header+nav 撤去・Provider ネスト維持）         | 🤖 自律 | `cd web && npm run build` exit 0                             |
| 7   | レスポンシブ/操作感の目視（広幅サイドバー↔狭幅ボトムタブ切替・全セクション遷移・Cmd+K・折りたたみ）     | 👀 目視 | 主要動線を手で1周（広幅/狭幅とも）— **ユーザー確認待ち**     |
| 8   | Draft PR → レビュー → main merge                                                                      | 🛑 人手 | PR レビュー & merge ボタン — **ユーザー操作**                |

### Gate 凡例

- **🤖 自律** — Claude 完結。後追い検証（tsc / test）で品質担保。Stop hook で型崩壊検出。
- **👀 目視** — レイアウト/体感は Claude では検証不能。ユーザーが画面で確認。
- **🛑 人手** — PR merge はユーザー操作必須。

---

## Acceptance Criteria (機械検証可能)

- [x] `cd shared && npm run build`（tsc -b）exit 0
- [x] `cd shared && npm run test`（vitest）全 pass（`useMediaQuery` / `AppShell` の最小 test 含む — 432 tests passed）
- [x] `cd web && npm run build`（tsc -b --force && vite build）exit 0
- [x] `cd frontend && npm run build`（旧 Tauri 非破壊の担保・並立期間中）exit 0
- [x] `shared/src/i18n/locales/en.json` と `ja.json` で新規ナビラベルキー（`nav.*` + `section.work`）が**両方**に存在
- [~] PR diff（新規4コンポーネント+フック+必須テスト2本で src 488 + test 174 行）。500 行は「機能追加目安」で、全行が Steps 1–6 と Acceptance（テスト必須）で要求された in-scope 実装。scope creep なし。
- [x] git diff が Scope 宣言パス内のみ（src/components・src/hooks・src/index.ts・i18n・tests・web/MainScreen）

---

## Risks / Known Issues 参照

- **既存 lean UI を壊すリスク**: AppShell は殻のみ。各セクション本体は `children` として現状コンポーネントをそのまま渡す（中身に手を入れない）ことで影響を局所化。
- **Provider ネストの破壊**: `AppShell` を `AudioProvider` の内側・現行 content 位置に正確に挿入する。`useShortcutConfig` / `useTimerContext` / `useAudioContext` の読み手が依然 Provider 内側にあること（§6.2）を差し替え後に目視。
- **matchMedia の SSR/テスト環境**: vitest（jsdom）で `matchMedia` 未定義になり得る → フックは未定義時に安全側（広幅既定）へフォールバックし、test は polyfill/モックで担保。
- **i18n props 注入の徹底**: shared 内で `useTranslation()` を直呼びしない（§6.4）。ラベルは `MainScreen` が `t()` で解決して props 注入。
- 着手前に `.claude/docs/known-issues/INDEX.md` を `shell` / `layout` / `matchMedia` で grep。

---

## References

- 親ロードマップ: `./2026-06-07-web-desktop-parity-roadmap.md`（W0〜W4・2層モデル・棚卸し）
- 移行 SSOT: `../../../2026-05-04-cross-platform-migration.md`
- frontend 規約: `../../../rules/frontend.md`（Provider 順序 / Pattern A / 配置表 / `notion-*` / i18n）
- 設計原則: `../coding-principles.md`（部品共通 / 画面分岐の2層モデル）
- 参照実装（FROZEN・読むだけ）: `frontend/src/components/Layout/`（`Layout.tsx` / `LeftSidebar.tsx` / `MobileLayout.tsx`）
- related skills: `lead-pipeline`（ティア判定）/ `role-pm → role-engineer → role-qa`（分解・実装・監査）/ `git-orchestrator`

---

## Worklog

- 2026-06-15（起草）: 調査の結果、W0〜W4 で機能は揃うがシェルが貧弱（`MainScreen` の横並びテキストナビ + `max-w-2xl` 単一カラム）と判明。ユーザー確定 = ①シェル刷新最優先 ②レスポンシブ単一（狭幅=ボトムタブ）③本タスクの成果物は計画書のみ。W5 として親ロードマップに接続。セクション内部 UX 深化は W6+ へ送り。
- 2026-06-15（実装 Steps 1–6）: `shared/src/hooks/useMediaQuery.ts`（matchMedia ラッパ・jsdom 未定義時は広幅 fallback）/ `shared/src/components/{NavItem,SidebarNav,BottomTabBar,AppShell}.tsx` を新設し barrel + `shared/src/index.ts` に export。`web/src/MainScreen.tsx` の素朴 header+nav（横並びテキスト + `max-w-2xl`）を `AppShell` へ差し替え。Provider ネスト（Sync→Shortcut→Timer→Audio）は不変・`AppShell` は `AudioProvider` 内側の旧 content 位置に挿入。section state（`section`/`setSection`/`paletteOpen`/`session`）は `MainScreen` 保持で props 注入、ラベルは `t()` 解決して注入（shared 内 `useTranslation()` 不使用）。i18n は `nav.*`（collapse/expand/commandPalette/signOut/more/moreTitle）+ `section.work` を en/ja 両 catalog に追加。`折りたたみ`状態は shell-display 関心として `useLocalStorage` で永続化（section state には混ぜない）。検証: shared build exit 0・shared test 432 pass（`useMediaQuery`/`AppShell` 最小 test 含む）・web build exit 0・frontend build exit 0（旧 Tauri 非破壊）。Scope 微修正（hooks/index.ts barrel は未存在 → public `index.ts` 直 export / Acceptance 必須の test 2 本を Scope へ追記）。残 = Step 7 目視（👀 ユーザー）・Step 8 merge（🛑 ユーザー）。
