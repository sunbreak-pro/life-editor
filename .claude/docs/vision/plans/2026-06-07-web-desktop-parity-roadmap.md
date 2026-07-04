---
Status: PLANNED — W0 未着手（統合 SSOT。2026-06-07 確定。Web を Desktop 同等へ）
Created: 2026-06-07
Owner-chat: main
Type: 親ロードマップ（各 Phase は子計画書 2026-06-XX-web-parity-w<N>-*.md に分割）
Parent: ../../../2026-05-04-cross-platform-migration.md（Phase 2 末〜Phase 5-A をまたぐ横断レーン）
Supersedes:
  - 2026-06-05-mobile-first-section-unification.md を「Schedule 以降」凍結（Work/Materials は完了温存。成果は W3 で共有層へ抽出）
Related:
  - 移行 SSOT: ../../../2026-05-04-cross-platform-migration.md
  - frontend 見た目統一（FROZEN）: ./2026-06-05-mobile-first-section-unification.md
  - Web Phase 2: ./2026-05-16-phase2-core-migration.md / S8(#47 DONE・archived) / S9(#49・目視 fix-pack 残)
  - Data Unification: ./2026-05-21-data-unification-items-meta.md
---

# Plan: Web/Mobile を Desktop 同等にする UI/UX パリティ ロードマップ（親計画）

> 移行 SSOT(`2026-05-04-cross-platform-migration.md`) の Phase 2 末〜Phase 5-A をまたぐ横断レーン。
> 本書は**全体ロードマップ（親）**。各 Phase の詳細実装計画は着手時に子計画書（`2026-06-XX-web-parity-w<N>-*.md`）へ分割する。

---

## 0. 現状把握と統合の経緯（2026-06-07）

本書は 2 つの並行レーンを 1 本に統合した親 SSOT。統合前の方針分散を 2 回のサブエージェント調査で解いた結果:

- **2 アプリ並走**: `frontend/`（Tauri 版・現行）と `web/`+`shared/`（Supabase 版・移行先）は別ツリー。**Schedule 等は二重実装**（frontend の凝った版 / web の lean 版）。
- **frontend は Phase 5 で破棄**（移行 SSOT L189 明記）。frontend を Mobile↔Desktop 統一していた `2026-06-05-mobile-first-section-unification.md` の成果（Work #50/#51・Materials #53）は **`web/`+`shared/` に 1 行も伝播しておらず、frontend ごと消える**。→ 同計画は **FROZEN**（Work/Materials は完了温存。統一プレイブック＝「Mobile を正とした棚卸し・"何を残し何を捨てるか" の判断」の知見は本書 **W3** で web 側へ活かす）。
- **死にブランチ**: `refactor/web-first-v2` は main の祖先（独自コミット 0・2 週間放置）。作業は main に集約済み。削除推奨（§計画書/ブランチの終い方）。
- **結論（ユーザー確定）**: frontend はこれ以上磨かず、**web を Desktop 同等へ引き上げる本ロードマップ（W0-W4）に注力**する。

---

## Context（なぜやるか）

- Phase 2 で `web/` のコア5機能（Tasks / Daily / Notes / Schedule / WikiTags）は **Option A = lean な新規ミニ UI** で移植完了した。意図的に旧 Tauri の凝った UI を移植せず、最小実装にとどめた。
- 結果、旧 Desktop（`frontend/` 679ファイル）に比べ **機能の幅・操作感が大きく不足**。Web 側には Settings / テーマ切替 / フォントサイズ / i18n / Trash / CommandPalette / Pomodoro / Audio などが**まだ無い**（汎用 DB はスキーマすら無い）。
- ユーザー要望: **Web の UI/UX を旧 Desktop 同等に**。さらに **3 配布形態（Electron Desktop / Web ブラウザ / Capacitor Mobile）が同じ shared の UI/UX を共用する**方向へ寄せる（移行 SSOT の「shared が React 本体、3 包装は薄い殻」思想の具体化）。
- **確定した方針（合意済み）**:
  1. スコープ = **未移植機能の追加を優先**（既存5機能の見た目磨きは後回し）
  2. 到達基準 = **操作感・情報密度の同等**（ink-\* で再構成。ピクセル一致は求めない）
  3. **UI 共通化は「2層モデル」**（下記）。部品とロジックは全環境共通、画面レイアウトは機能別判断。
  4. **データ / サービスは環境別のまま維持**（DataService 抽象の境界は不変。統一しない）
  5. 汎用 **Database は凍結継続**（今回ロードマップから除外。Phase 5-A 方針維持）
  6. 着手順 = **UX 基盤を最初に**
  7. 設計原則「部品共通 / 画面分岐」を `docs/vision/coding-principles.md` に**恒久原則として記録**

---

## 中核設計思想：UI 共通化の「2層モデル」

UI を 2 層に分けて、共通化の度合いを層ごとに変える:

| 層                             | 内容                                                                                      | 共通化方針                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **部品層（デザインシステム）** | ボタン / 入力欄 / カード / モーダル / シート / 色・余白・文字サイズ（ink-\* トークン） | **全環境で完全共通**（shared に集約。直す場所 1 箇所）                        |
| **画面層（レイアウト）**       | 各機能画面の組み立て方                                                                    | **機能特性で判断**：単純画面=レスポンシブ単一 / 複雑画面=Desktop・Mobile 分割 |

- **単純画面（レスポンシブ単一でよい）**: 縦に並ぶリスト系。Settings / Trash / Notes / Daily 等。1 コンポーネントが画面幅で伸縮。
- **複雑画面（環境別に分割した方が綺麗）**: 操作モデルが PC とスマホで別物のもの。Schedule カレンダー / Tasks の DnD ツリー / Work タイマー。マウスドラッグ vs タップ＋BottomSheet。無理に単一化すると分岐だらけで破綻する。
- **やりすぎ回避**: 全画面を 1 コンポーネントで完全レスポンシブ化はしない。複雑画面は割り切って分ける。
- **データを環境別に分けるのと同じ発想**を UI にも適用：共通の部品 + 環境差が出るところだけ分岐。

> **section-unification（FROZEN）からの継承**: frontend で確立した「Mobile を正とした統一プレイブック」と `<View variant>` パターン、各セクションの棚卸し結論（Work=History/Music/FREE 削除・TaskSelector 維持 / Schedule=週ビュー・Dual Column・CalendarTags・検索は削除）は、**本書の複雑画面（W3 Work / Schedule）を web に作るときの "何を作り何を作らないか" 仕様の参照元**として使う。frontend のコードは移植しない（Tauri 依存・破棄予定）。

---

## Scope（触ってよいパス）

```
shared/src/components/   ← 新設（現状 shared は UI ゼロ）。デザインシステム + 共通画面
shared/src/context/ , shared/src/hooks/ , shared/src/types/
shared/package.json , shared/tsconfig*.json   ← UI 対応のため改変（W0）
web/src/
supabase/migrations/     ← Settings/Timer/Audio で新テーブルが要る場合のみ
.claude/docs/vision/plans/        ← 子計画書
.claude/docs/vision/coding-principles.md  ← 2層モデルを恒久原則として追記（W0）
CLAUDE.md , 2026-05-04-cross-platform-migration.md  ← 方針転換の記録（W0完了時）
```

**対象外（明示）**:

- `frontend/`（旧 Tauri。参照元としてのみ読む。改変しない＝FROZEN）
- `desktop/`（Phase 3 Electron）/ `mobile/`（Phase 4 Capacitor）= 未作成。本計画は「shared 側を 3 包装が使える形に整える」までを担い、包装自体は移行 SSOT Phase 3/4 の担当。
- 他チャット worktree（`prototype-*` / `work-*`）

---

## 棚卸し結果（未移植機能の分類）

| 機能                               | Desktop規模   | Tauri依存    | Web現状             | 扱い                       | 画面層の想定          | 難易度 |
| ---------------------------------- | ------------- | ------------ | ------------------- | -------------------------- | --------------------- | ------ |
| Settings(theme/font/i18n/shortcut) | 25f / 4416行  | なし         | 完全未              | **W1**                     | 単純→レスポンシブ単一 | M-L    |
| Trash                              | 1f / 510行    | なし         | 未                  | **W2**                     | 単純→レスポンシブ単一 | S      |
| CommandPalette                     | 1f / 195行    | なし         | 未                  | **W2**                     | 単純→単一(モーダル)   | S      |
| Work                               | PR#51統合済   | なし         | web済(shared抽出残) | **W3**                     | 中→一部分割           | S      |
| Pomodoro/Timer                     | 30+f / 2504行 | なし         | shared型のみ        | **W3**                     | 中→分岐               | M-L    |
| Audio Mixer                        | 6f / 264行    | なし         | shared型のみ        | **W3**                     | 単純→単一             | M      |
| Analytics                          | 31f / 3200行  | なし         | 未                  | **W4**                     | 複雑→分割寄り         | M      |
| Connect(node graph)                | 32f / 7500行  | 一部         | 未(Notes/Daily済)   | **W4**                     | 複雑→分割             | L      |
| 汎用 Database                      | 13f / 2296行  | なし         | スキーマ無し        | **凍結**                   | —                     | L      |
| Materials                          | 7f / 1732行   | 軽微         | —                   | **対象外**(Desktop専用 §2) | —                     | —      |
| Layout/TitleBar                    | 10f / 1846行  | TitleBarのみ | MainScreen が代替   | **対象外**(Web不要)        | —                     | —      |
| Terminal                           | —             | 濃い         | —                   | **対象外**(Desktop専用)    | —                     | —      |

ほぼ全機能が **Tauri 依存ゼロ** → shared 移植は素直。

---

## 共通設計方針

1. **UI 共通化 = 2層モデル**（上記）。部品は shared 完全共通、画面は機能別に単一/分割。
2. **UI 集約先の確定（W0 の主題・要承認）**: 現状 `shared` は UI 依存ゼロの純粋データ層（deps は supabase-js のみ）。UI を入れるには `shared/package.json` に `lucide-react` 等を追加し tsx を emit する構成へ拡張が要る。2 案を W0 で確定:
   - **案 A（推奨・ユーザー選択）**: `shared/src/components/` を新設し UI（デザインシステム + 共通画面）を集約。shared が UI 依存を持つ。Electron/Capacitor が即共用できる。
   - **案 B（代案）**: 別パッケージ `ui/` を新設し shared(データ層) と分離。shared の純粋性を保つ。構成は綺麗だがパッケージが 1 つ増える。
3. **ink-\* トークン厳守**（ハードコード禁止 / 不透明背景。CLAUDE.md §6.4）。デザインシステムの色・余白はトークンに集約。
4. **i18n 基盤の新規導入（W0）**: 現状 web/shared に react-i18next が無い（ハードコード）。en/ja を `frontend/src/i18n/locales` から移植し共有層に provider を据える。以後の移植機能は i18n-first。
5. **DataService はコールバック注入 / Pattern A / Mobile 省略 Provider は Optional バリアント**（CLAUDE.md §6.2-6.4）。
6. **Provider 順序**: web ルートに Theme / ShortcutConfig / Timer / Audio を §6.2 順で追加（Mobile 省略分を除く）。

---

## Phase 構成（着手順）

### W0 — 共有 UI 基盤 + デザインシステム + i18n（前提整備）

- [ ] UI 集約先を案A/案Bで確定
- [ ] 共有層を tsx 対応に（package.json に UI 依存追加 / tsconfig JSX / Tailwind クラス解決確認 / vitest）
- [ ] **デザインシステム層**を shared に新設：ink-\* トークン整理 + 共通部品（Button / Input / Card / Modal / BottomSheet / IconButton 等）。web の既存 lean UI も段階的にこれへ寄せられるが、移設は無理にやらない。
- [ ] react-i18next 導入 + en/ja locales 移植 + 共有 i18n provider
- [ ] **2層モデルを `docs/vision/coding-principles.md` に恒久原則として追記**
- [ ] Option A → 共有 UI 集約への**方針転換を CLAUDE.md / 移行 SSOT に記録**
- Gate: 🤖 自律（構成変更）+ 🛑 案A/B最終判断
- Acceptance: 共有部品を使った最小画面が web から mount でき `tsc -b` / `vite build` green / shared vitest green

### W1 — UX 基盤（Settings / Theme / FontSize / Shortcut）★最初の実装

- [ ] `ThemeContext`（ダーク/ライト・フォント10段階 12-25px）を共有層へ移植
- [ ] `ShortcutConfigContext`（Mobile 省略 = Optional）を共有層へ
- [ ] Settings 画面（**単純→レスポンシブ単一**）+ AppearanceSettings / BehaviorSettings 相当の lean UI。共有部品で組む。
- [ ] Web 不要項目は除外（auto-launch / tray / global-shortcut / MCP tools list は Electron 専用）
- Gate: 🤖 実装 → 👀 テーマ/フォント切替の見た目目視
- Acceptance: テーマ・フォントサイズ切替が web で効く / 永続化 / `tsc -b`・eslint・vite build green

### W2 — 即効 2 機能（Trash + CommandPalette）

- [ ] Trash（**単純→レスポンシブ単一**）: 復元/完全削除ロジックを共有層、6 context の soft-delete 一覧 UI
- [ ] CommandPalette（**単一モーダル**）: コマンド定義 + 検索/キーボード処理を共有層、Cmd+K で起動
- Gate: 🤖 実装 → 👀 動作目視
- Acceptance: 削除→Trash→復元が往復 / Cmd+K でパレット起動・遷移

### W3 — Work / Timer / Audio 統合（要・並行チャット調整）

- [ ] Work UI を共有層へ抽出（PR#51 で frontend に残る分。"mobile が source of truth"。**section-unification の Work 棚卸し結論を仕様として流用**）。**中→一部分割**
- [ ] TimerContext/Reducer を共有層へ（既存 `timer_sessions` / `pomodoro_presets`）。**PC/Mobile で表示分岐**
- [ ] Audio Mixer を共有層へ（Web Audio API。Mobile 省略 = Optional。`sounds`/`playlists`）。**単一でよい**
- ⚠️ **prototype-mobile チャットが Timer/Audio/共通Shell のモバイル版を専有していた可能性**。着手前に comm/ で境界調整・成果取り込み（現状 worktree は #48 マージ済・実ソース未コミット変更なしを確認済だが、念のため）
- Gate: 🤖 実装 → 👀 体感 → 🛑 並行チャット調整
- Acceptance: Pomodoro 計測→session保存 / 環境音ミックス再生 / Work タブが web で動く

### W4 — Analytics + Connect（Tier3・後回し）

- [ ] Analytics（**複雑→分割寄り**）: 集計ロジックを共有層 + recharts UI（複数タブ）
- [ ] Connect（**複雑→分割**）: node graph(@xyflow/react) ＋ backlink ビュー
- Gate: 🤖 実装 → 👀 目視
- Acceptance: 主要集計が描画 / ノートグラフ表示・遷移

### W5 — アプリシェル刷新（サイドバー + レスポンシブ単一ナビ）★子計画書 `2026-06-15-web-parity-w5-app-shell.md`

- W0〜W4 で揃った各セクションを束ねるシェル（ナビ/レイアウトの殻）を Desktop 同等へ。現状 `MainScreen` は横並びテキストナビ + `max-w-2xl` 単一カラムで貧弱。
- **単純画面 → レスポンシブ単一**: 広幅=左サイドバー（折りたたみ可）/ 狭幅=ボトムタブ + More シート。shared に `AppShell` / `SidebarNav` / `BottomTabBar` を新設。
- セクション**内部**の UX 密度（DnD / 詳細パネル / カレンダー充実）は W6+ の子計画書へ送り。
- Gate: 🤖 実装 → 👀 目視 → 🛑 PR merge
- 2026-06-15: Steps 1–6 実装済（`AppShell` / `SidebarNav` / `BottomTabBar` / `NavItem` / `useMediaQuery` 新設・`MainScreen` 差し替え。shared/web/frontend build + shared test 緑）。残 = Step 7 目視 / Step 8 merge。

### W6 — セクション内部深化 第1弾（右サイドパネル / Master-Detail 3ペイン）★子計画書 `2026-06-16-web-parity-w6-detail-panel.md`

- シェル（W5）の内側＝セクション本体の情報密度を上げる第1スライス。広幅で「サイドバー＋リスト＋詳細」の3ペインを成立させる共有 `MasterDetail`（純粋表示2スロット・`useMediaQuery` で広幅2カラム / 狭幅 `BottomSheet`）を新設し、**Notes をパイロット**採用。Tasks 詳細（選択基盤の新設要）→ **W7** / Schedule カレンダー充実 → **W8**。
- Gate: 🤖 実装 → 👀 目視 → 🛑 PR merge

### W7 — セクション内部深化 第2弾（Tasks 詳細パネル / Master-Detail 採用第2弾）★子計画書 `2026-06-18-web-parity-w7-task-detail.md`

- W6 の共有 `MasterDetail` を **Tasks** に第2採用。Tasks には Notes 相当の選択状態が無いため shared の Tasks API（`useTaskTreeAPI` / `TaskTreeContextValue`）に `selectedTaskId` / `setSelectedTaskId` / `selectedTask` を新設（DataService 非依存・削除で null 化、Notes と同挙動）。新規 `TaskDetailPanel`（shared 集約・純粋表示・props 注入）= title 編集 / status トグル / content リッチテキスト編集。`AppShell`（W5）/ `MasterDetail`（W6）は無改変で再利用。
- Gate: 🤖 実装 → 👀 目視 → 🛑 PR merge

### W8 — セクション内部深化 第3弾（Schedule カレンダー充実 / 週・日タイムグリッド）★子計画書 `2026-06-19-web-parity-w8-schedule-calendar.md`

- 2層モデルの**複雑画面**代表 = Schedule。`schedule_items`（`date` + `HH:MM` start/end を保持）を**週/日タイムグリッド**で可視化。広幅=マウス操作の週グリッド / 狭幅=タップ前提の日アジェンダ + `BottomSheet` 編集に**割り切って分割**。位置計算は純関数（`scheduleGridLayout.ts`）に外出しして unit test で固める。**DDL ゼロ**（既存フィールド可視化）。イベント DnD は任意の最終ステップ（リスク次第で W8+ へ）。Routine 生成（`RoutineScheduleSync`）/ `ScheduleView` / `CalendarView` は無改変。
- Gate: 🤖 実装 → 👀 目視 → 🛑 PR merge
- 2026-06-20: コア **Steps 1–6 実装完了**（`feat/w8-schedule-calendar`・PR 未作成）。`WeekTimeGrid`（shared 純粋表示）+ `scheduleGridLayout.ts`（純関数・19 test）+ en/ja i18n + web `ScheduleCalendarView`（広幅=週グリッド / 狭幅=日アジェンダ + シート・既存 CRUD 流用）。DnD=Step 7 は W8+ 送り。shared/web/frontend build + shared test 462 緑・web eslint 0err。残 = 👀 目視 / 🛑 PR。

---

## 並行チャット境界（2026-06-07 現状）

統合チャット（main）の調査で、下記 worktree はいずれも **対応 PR が main マージ済・実ソースの未コミット変更なし**を確認済み。「専有」は起草時点の宣言で、現状は整理可能。

- **prototype-mobile**（`prototype/fix-schedule-esc-duplicate`）: モバイル UI を専有していた（Materials / Schedule / Pomodoro / 共通 Shell のモバイル版）。**#48 マージ済・clean（生成物のみ dirty）**。W3 の Timer/Audio で領域が重なるため、着手前に成果取り込みの要否だけ確認。2層モデルの「複雑画面の Mobile 分割」はこのレーンの知見と接続する。
- **work-unify**（`feat/work-section-mobile-unify`）: Work 統合(#50/#51)済。W3 の Work 抽出はこの成果を共有層へ移す残作業。
- **materials-cleanup**（`feat/materials-section-cleanup`）: #53 済・clean。
- **du-g**: ほぼアイドル（DnD 統一完了、軽微 follow-up のみ）。

---

## Risks / 留意点

- **shared に UI を入れる構造変更（W0・最大の論点）**: 現在の「shared = 純粋データ層」を崩す。案 B（`ui/` 分離）の方が綺麗。W0 で必ず確定し記録する。
- **i18n 導入は全 web コンポーネントに波及**（現状ハードコード）。W0 で基盤、以後を i18n-first にして漸進。既存 lean UI の i18n 化は無理にやらない。
- **2層モデルの線引きは画面ごとに判断が要る**: 「単純/複雑」の境界を子計画書で明示してから着手（迷ったら単一→必要時に分割へ）。
- **W3 の並行衝突**: prototype-mobile と Timer/Audio が重複しうる。先に comm 調整。
- **コスト $0 厳守**: Timer/Audio 系テーブルは既存 migration に有り。新規追加は Supabase 無料枠内。
- **既存 web lean UI を壊さない**: Tasks/Daily/Notes/Schedule/WikiTag は動作中。今回は触らない。

---

## Verification（各 Phase 共通の機械検証）

- [ ] `cd web && npm run build`（tsc -b --force && vite build）exit 0
- [ ] `cd web && npx eslint .` 0
- [ ] `cd shared && npm run build`（tsc -b）exit 0 / `cd shared && npm run test`（vitest）green
- [ ] `cd frontend && npm run build`（旧 Tauri 非破壊の担保。並立期間中）exit 0
- [ ] DDL を伴う場合: ローカル migration ファイル先行 → ユーザー `supabase db push` or SQL Editor（`apply_migration` MCP 単独使用禁止）

---

## 計画書 / ブランチの終い方（cleanup）

統合に伴う Status 是正（コードの git log を正とする）と、死にブランチ/worktree の整理。

### 計画書 Status 是正（実施済み・commit 812fa1c）

| 計画書                                         | 是正                                                                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 2026-06-05-mobile-first-section-unification.md | **FROZEN**（Schedule 以降凍結・Work/Materials 完了温存。Schedule 設計は web 移植仕様の参照元として保全） |
| 2026-06-06-web-phase2-s8-realtime.md           | **DONE #47** → `archive/` 移動済                                                                         |
| 2026-06-06-web-phase2-s9-mobile-responsive.md  | 「実装 #49 マージ済 / 目視 fix-pack 残」明確化                                                           |

### ブランチ / worktree 整理（破壊的・ユーザー承認後に実行）

- `refactor/web-first-v2`（死にブランチ・main の祖先・独自コミット 0）削除
- マージ済み worktree prune: `work-mobile-unify`(#50/#51) / `materials-cleanup`(#53) / `prototype-mobile`(#48) / `docs-bash-stability` / `s9-mobile`（本書を main へ取り込み後）
- **要確認**: `docs/bash-tool-stability-rule` の未 push コミット `c1633a1`（CLAUDE.md への bash 安定性ルール追記・main 未反映・他のどこにも無い）を拾うか捨てるか

---

## 次アクション

1. 本ロードマップ（親）を統合 SSOT として確定（**完了**: main commit 済）
2. task-tracker の「予定」に W0→W4 を登録
3. （ユーザー承認後）死にブランチ + マージ済み worktree の整理（§終い方）
4. **W0 着手**: 案A/案B 確定 → 共有 UI 基盤 + デザインシステム + i18n + 2層モデルの原則記録。新 worktree を `origin/main` 最新から作成。role-pm で W0/W1 を分解 → role-engineer 実装 → role-qa 独立監査

---

## Worklog

- 2026-06-07（s9-mobile 起草）: W0-W4 ロードマップ・2層モデル（部品共通/画面分岐）・未移植機能の棚卸しを設計。方針 7 項目をユーザー合意。UI 集約案 A を選択。
- 2026-06-07（main 統合）: 別チャット（main）が section-unification 凍結の交通整理と本書を統合。2 レーン衝突調査（frontend vs web/shared）の結果を §0 に集約し、frontend を磨かず **web を Desktop 同等へ** で一本化。当初 main で起草した薄い交通整理版を、本 s9-mobile 詳細版で置換し親 SSOT に確定。計画書 Status 是正（section-unification FROZEN / S8 DONE→archive / S9 明確化）を commit 812fa1c で実施。死にブランチ・worktree 整理はユーザー承認後。
