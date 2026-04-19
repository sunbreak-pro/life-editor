# HISTORY.md - 変更履歴

### 2026-04-19 - vision/ 整理 + Mobile 移植計画ドキュメント化

#### 概要

`.claude/docs/vision/` を「設計原則 + 次フェーズ計画」の 4 ファイル構成に再編。当面着手しない Cognitive Architecture 構想（`ai-integration.md`）と役目終了テンプレ、CLAUDE.md §9 と重複する README を削除し、主戦場となる Mobile 移植計画と Desktop 残課題メモを新設。CLAUDE.md の陳腐化参照も同時整理（341 行、400 行上限内）。主目的（Daily / Note / Schedule table の読み書き）は既存 MCP 30 ツールで充足済みという認識を文書化。

#### 変更点

- **vision/ 削除 3 件**: `ai-integration.md`（Cognitive Architecture 当面凍結）/ `2026-04-18-application-definition-template.md`（Phase A-2 役目終了）/ `README.md`（CLAUDE.md §9 と重複）
- **vision/coding-principles.md 改訂**: §5 Cognitive Architecture 節を削除、§6 更新フローが §5 に繰り上がり（§1-4 設計原則は不変）
- **vision/mobile-porting.md 新規**: Desktop → iOS 移植 + Cloud Sync 連携の主戦場ドキュメント。3 本柱（Daily / Note / Schedule）、範囲内 / Mobile 省略 6 Provider 範囲外、連携ハブ（Cloudflare Workers + D1）、次のアクション 4 件（iPhone シミュレータ検証 / Notes iOS 編集 / Sync 既知 Issue 解消 / 移植順ロードマップ）を明記
- **vision/desktop-followup.md 新規**: Desktop 残課題（Materials File タブ / Notes (Node) / Board）を短くメモ。新規大型機能は立てず、個別実装は別途 `.claude/YYYY-MM-DD-<slug>.md` で扱う方針
- **CLAUDE.md 参照整理**: §3.4 の `claude_*` テーブル言及削除 / §4.5 の `2026-04-17-daily-life-hub-requirements.md` 参照削除 / §5 の `ai-integration.md` リンク + §5.3 Cognitive Architecture 節削除 / §8 Tier 3 は Cognitive を「当面凍結」表記で維持（リンクなし）/ §8 末尾に次フェーズ計画リンク（mobile-porting / desktop-followup）追加 / §9 内 `coding-principles.md §6` → `§5` に調整
- **計画書**: `~/.claude/plans/vision-daily-note-schedule-table-mcp-ma-toasty-tower.md` はグローバルスキャッフォールド領域のため `.claude/archive/` 対象外

---

### 2026-04-19 - ディスク容量削減（life-editor 全体 12GB → 3.7GB / -69%）（計画書: 外部 `~/.claude/plans/life-editor-elegant-emerson.md`）

#### 概要

`life-editor/` 配下 12GB の容量分析を実施し、リスク別の段階的クリーンアップを実行。孤立ワークツリー（別プロジェクト残骸）+ Rust ビルドキャッシュ + 全 node_modules を除去しつつ iOS 関連データ（3.3GB）は保持。全削除操作を macOS ゴミ箱経由で行い復元可能性を担保。最終 3.7GB（-8.3GB）。

#### 変更点

- **容量分析**: 上位 13 カテゴリを計測。最大は `src-tauri/target` 9.6GB（全体 83%、Rust debug/release/iOS で依存クレート重複ビルド）。`.claude/worktrees/jovial-shannon` 886MB は `package.json: "sonic-flow"` / `electron/` 含む別プロジェクト残骸と判明（`git worktree list` 非登録）
- **孤立ワークツリー除去**: `.claude/worktrees/jovial-shannon` をゴミ箱へ → `git worktree prune -v` でメタデータ（`.git/worktrees/jovial-shannon`）も自動除去
- **Git オブジェクト圧縮**: `git gc`（`--prune=now` は harness に denied されたためデフォルト 2 週間 expiry で実行）。loose 5547 個・112MiB → pack 化、`.git` 117MB → 79MB
- **Rust ビルドキャッシュ除去**: `src-tauri/target/{debug, release}` をゴミ箱へ（合計 7.0GB）。**iOS ターゲット `target/aarch64-apple-ios` 2.7GB は保持**（ユーザー選択・近日 iOS 作業予定のため）
- **node_modules クリーンアップ**: 4 階層全 `node_modules`（root / frontend / cloud / mcp-server、合計 594MB）をゴミ箱へ → `frontend` と `mcp-server` のみ即 `npm install` で再導入、`cloud` と root は必要時に再インストール
- **Vite 出力除去**: `frontend/dist` 25MB をゴミ箱へ
- **削除方式**: 初回 `rm -rf` が harness に denied されたため `/usr/bin/trash` による macOS ゴミ箱移動に切替。全操作が復元可能状態
- **結果**: 12GB → 3.7GB（3.3GB = src-tauri / 292MB = frontend / 63MB = mcp-server / 残りは .git + .claude + resources 等）
- **副作用**: 次回 `cargo tauri dev` は初回フルビルド（約 10-20 分）を要する
- **再発防止メモ**: `.claude/worktrees/` と `git worktree list` の乖離を定期確認、Rust incremental キャッシュは月次 `cargo clean`、iOS 作業終了後は Level 3 クリーンアップで追加 3.3GB 削減可能

---

### 2026-04-19 - Mobile UI/UX 改善 第 2 弾（Calendar / Sheet / Routine Group / Note/Memo TipTap / ジッター軽減）

#### 概要

Mobile 版の UX 問題 9 件をユーザーフィードバックに沿って段階実装。第 1 弾で Schedule 全アイテム表示 / 3-mode bottom sheet / Routine グループ化 / Note・Memo の TipTap 化を実装し、第 2 弾で Daycell をチップ形式に戻し、Note/Memo 詳細の seed バグと月ナビゲーションバグを修正、新規スケジュール項目の memo 永続化、viewport 単位を `svh` に置換して iOS での pixel jitter を軽減。`tsc` 0 / `eslint` 0 / `vitest` 200/200 pass。

#### 変更点

- **Daycell 表示刷新 → 復元**: 第 1 段でドット表示に変更したが、ユーザー要望で**タイトル付きチップ + 最大 3 件 + `+N more`** のデスクトップ踏襲デザインに復元（`MobileEventChip.tsx` を再作成、`MobileDayDots.tsx` 削除）。セル幅超過時は ellipsis で切り詰め。全 item 種（tasks / events / routines）が対象で `buildMonthItemMap` を活用

- **Bottom Sheet 3-mode 化**: `MobileDaySheet.tsx` の `expanded: boolean` を `mode: "hidden" | "half" | "full"` に変更。half=38svh / full=70svh。drag down で段階的に縮小（full→half→hidden）、X ボタンで即時クローズ、ハンドルタップで half↔full トグル。full 時は上 30svh のカレンダーが見え Daycell タップで日付切替可能

- **Routine グループ UI**: `MobileDayflowGrid.tsx` を全面書き換え。`assignColumns()` で同時間帯アイテムのカラム分割（デスクトップ `ScheduleTimeGrid` のアルゴリズム移植）、タイトル ellipsis、デスクトップの `GroupFrame.tsx` を再利用してルーチングループを視覚化。`MobileDaySheet` にもグループ別 Accordion を追加（`ChevronDown` で開閉、グループ色で枠 + 背景着色）

- **Note/Memo TipTap 化**: `shared/MobileRichEditor.tsx` を新規作成（StarterKit + Placeholder、400ms debounce 自動保存、unmount / beforeunload で pending flush）。`MobileNoteView.tsx` / `MobileMemoView.tsx` の textarea を置換し保存ボタン削除。詳細画面は親で `key={selectedId|date}` を付けた keyed sub-component（`MobileNoteDetail` / `MobileMemoDetail`）に分離し、「初回選択で本文空表示」「2 回目に前回内容が表示される」 seed バグを解消

- **Calendar 月ナビゲーション修正**: `<` `>` ボタンで次月/前月へ遷移するバグ（viewDate を render 中に setState で上書きし元の月に戻る）を修正。`viewDate` state を `MobileCalendarView` 親に昇格し、`useEffect` で selectedDate 変更時のみ同期する形に変更。月データ fetch を viewDate ベースに切替。Search アイコンは将来実装まで非表示

- **新規スケジュール項目の memo 永続化**: `createScheduleItem` シグネチャに memo パラメータが存在しないため、create 直後に `updateScheduleItem({ memo })` を follow-up する形で保存（`MobileCalendarView.handleSave`）。既存 edit パスは変更なし

- **iOS pixel jitter 軽減**: `h-dvh` / `38dvh` / `70dvh` を全て `svh` (Small Viewport Height) に置換 —— `MobileLayout.tsx` / `MobileDaySheet.tsx` / `MobileCalendarView.tsx` (FAB) / `MobileWorkView.tsx`。加えて root に `overscroll-behavior: none` / main に `contain` を設定。URL バー・safe area 変動に伴う数 px の再計算を抑制

- **i18n**: `en.json` の `mobile.calendar.moreCount` を `"+{{count}}"` → `"+{{count}} more"` に更新（要件準拠）。ja は既存の `"+{{count}}件"` を維持

- **削除**: `MobileEventChip.tsx` を第 1 段で削除 → 第 2 段で再作成（同内容）。`MobileDayDots.tsx` は第 1 段で作成 → 第 2 段で削除

### 2026-04-18 - Mobile Schedule & Work リデザイン（claude.ai/design バンドル準拠）（計画書: archive/2026-04-18-mobile-schedule-work-redesign.md）

#### 概要

Claude Design で作成された HTML/JSX プロトタイプ（`gysUUHAKNxXSabDTE32e1Q`）を基に、モバイル版 Schedule（旧 Calendar）と Work 画面を全面刷新。ユーザーがチャットで挙げた要件（DayCell 内アイテム chip + 下スワイプボトムシート、chip ellipsis truncation、Dayflow timegrid、タブ 4 統合）をコードに移植。全 200 テスト pass / tsc / lint / build clean。

#### 変更点

- **タブ構造刷新**: `MobileTab` を `"calendar"` → `"schedule"` に改名、順序を **Schedule / Work / Materials / Settings** に並び替え（`MobileLayout.tsx` / `MobileApp.tsx`）。初期 activeTab も `schedule` に変更。

- **Schedule Monthly 全面書き換え**: `MobileMonthlyCalendar`（`MobileCalendarView.tsx` 内）で各 DayCell に最大 3 件の inline event chip を表示、+4 件目は `+N件` overflow。均等 grid 保持のため `min-width:0` / `max-width:100%` / `overflow:hidden` を cell と chip container に適用し、長いタイトルでも列幅が崩れない。今日 = accent 丸塗り、選択日 = accent リング + tint bg、土日色分け（red-400/500）。月ヘッダーに search/today/prev/next ボタン追加。

- **Bottom sheet 新規**: `schedule/MobileDaySheet.tsx` を追加。drag handle（touch+mouse 両対応）、`38dvh ↔ 80dvh` 切替、±40px しきい値、`cubic-bezier(.2,.8,.2,1)` 280ms アニメ。タイムライン行は `{start}/{end}` カラム + 左 rail + card（check + icon + title + kind ラベル）構成。Strict Mode 対策として drag-end の副作用を state updater 外へ。

- **Dayflow timegrid 新規**: `schedule/MobileDayflowGrid.tsx` を追加。5:00–24:00 の 1 カラム時刻グリッド（54px/hour）、30 分ごと破線、イベントブロックを start/end から絶対配置、左 3px rail（kind 色）、title ellipsis。今日のみ赤い now ライン + 丸（30 秒ごと位置更新）。マウント時・日付切替時に current hour（today）または 8:00 へ auto-scroll。Dayflow ヘッダー（月日 + 曜日 + TODAY バッジ + prev/today/next）を `MobileCalendarView` 内に追加。

- **Work 画面全面書き換え**: `MobileWorkView.tsx` を以下で再構成 —— `WorkSessionTabs`（集中/休憩/長休憩 + duration 分数、active 時 pill 内白背景 + shadow）、`WorkActiveTaskChip`（4px 左 rail + `取り組み中` ラベル + タスク名 ellipsis + chevron）、`TimerRing`（280px SVG、二重 stroke + gradient + blur(8px) halo、running で opacity 1）、`SessionDots`（done = 18px rounded rect、未完 = 6px dot）、`ControlDock`（Reset 52px / Play-Pause 76px / Skip 52px、session color で shadow）。ambient 音楽カードはスコープ外として未実装（AudioProvider がモバイル非対応）。

- **データ層純関数追加**: `schedule/dayItem.ts` で `DayItem` discriminated union（`routine` / `event` / `task`）と `buildDayItems` / `buildMonthItemMap`。判定ルール: `ScheduleItem.routineId` → routine / 他の ScheduleItem → event / `TaskNode.scheduledAt` → task。`dayItem.test.ts` に 10 ケース（kind 判定、all-day、filter、sort、soft-delete、month grouping）。

- **Chip kind 用 CSS vars**: `index.css` の `:root` と `[data-theme="dark"]` に `--color-chip-{routine,event,task}-{bg,fg,dot}` を合計 9 個追加。Light/dark 両テーマで可読性を担保。

- **Tailwind token 誤用修正**: 新規コードで `bg-notion-bg-primary` / `text-notion-text-primary`（CSS var 未定義で no-op）を正しい `bg-notion-bg` / `text-notion-text` に統一。既存モバイルコードの誤用は変更範囲外として保留。

- **i18n キー追加（en/ja 両方）**: `mobile.tabs.schedule`, `mobile.schedule.subTab.*`, `mobile.schedule.daySheet.*`, `mobile.schedule.dayflow.*`, `mobile.work.focusTitle`, `mobile.work.activeTaskLabel`, `mobile.work.sessionLabel.*`, `mobile.work.session.*`, `mobile.work.sessionSub.*`, `mobile.work.remaining`, `mobile.work.dotsProgress`, `mobile.work.controls.*`。旧 `mobile.tabs.calendar` は削除（参照残存なし確認済）。

- **react-hooks/set-state-in-effect 違反修正**: `MobileMonthlyCalendar` の `useEffect(setViewDate)` を render-time 補正パターンに変更（React 公式の「props から state を調整」パターン、収束判定により無限ループなし）。

- **react-refresh/only-export-components 違反修正**: `kindPalette` ユーティリティを `MobileEventChip.tsx` から `schedule/chipPalette.ts` に分離。`MobileDaySheet` / `MobileDayflowGrid` の import 先も更新。

- **自動検証全通過**: `npx tsc --noEmit` 0 エラー / `npx eslint` 0 エラー（変更ファイル）/ `npx vitest run` 24 files 200 tests pass / `npm run build` 13.1s 成功。

### 2026-04-18 - .claude/ 構造モダナイゼーション（CLAUDE.md 軽量化 + ADR 廃止 + グローバルスキル整合）

#### 概要

life-editor の `.claude/` を全面再編し、同時にグローバルスキル（/project-setter / task-tracker / session-verifier / session-loader）を新構造に整合させた。CLAUDE.md を 805 → 345 行に圧縮しコンテキスト効率を改善。ADR 方式を廃止し、設計原則を `docs/vision/` に一元化する運用に切替。全プロジェクト共通の運用ルールを `~/.claude/CLAUDE.md` に明文化。

#### 変更点

- **life-editor CLAUDE.md 軽量化**: 805 行 → 345 行（-56%）。ビジョン系 §1-5 / AI 詳細 §8.3-8.4 / デバッグ詳細 §10.5 / Review Checklist §10.6 / 実装済み機能リスト §11 補足 / Roadmap 完了履歴を削除、抽象構想は `docs/vision/` に分離

- **docs/vision/ 新設**: `README.md` / `core.md`（Core Identity / Target User / Value Props / Non-Goals / Platform Strategy 詳細）/ `ai-integration.md`（Cognitive Architecture 要旨 + 利用シナリオ）/ `coding-principles.md`（旧 ADR-0002/0003/0004/0006/0007 の要旨統合）

- **ADR 廃止**: `docs/adr/` (ADR-0005/0006/0007) と `archive/adr/` (0001-0004) を全削除。設計原則は vision/coding-principles.md に集約し、時点判断ではなく「現在から未来に向けた継続更新される指針」として運用

- **feature_plans/ 廃止**: `2026-04-18-app-redefinition-roadmap.md` → `archive/`、`2026-04-17-daily-life-hub-requirements.md` / `application-definition-template.md` → `docs/vision/`、ディレクトリ自体を削除。実装プラン命名規則は `.claude/YYYY-MM-DD-<slug>.md`（直下配置）に統一

- **/project-setter 全面更新**: SKILL.md に新構造マッピング表と設計思想（400 行上限 / ADR 不使用 / vision 一元化）を追記。Software / Novel / Research 全 3 タイプで `vision/` + `known-issues/` + `requirements/` (Software のみ) のテンプレート追加、旧 `adr-template.md.tmpl` / `operations.md.tmpl` / `coding.md.tmpl` / `writing.md.tmpl` / `methodology.md.tmpl` を削除。`~/.claude/skills/project-setter` にシンボリックリンク作成

- **グローバル `~/.claude/CLAUDE.md` 拡張**: 13 行 → 54 行。Project Documentation Structure セクション追加（ファイル階層 / 運用原則 / CLAUDE.md 標準 9 章構成）。全プロジェクト共通のルール（400 行上限、ADR 不使用、実装プラン命名規則、known-issues 運用）を明文化

- **task-tracker 更新**: 計画書パスを `.claude/docs/feature_plans/` → `.claude/` 直下に、アーカイブ先を `.claude/docs/archive/` → `.claude/archive/` に変更。ヘッダーコメントから廃止済み `rules/operations.md` 参照を削除

- **session-verifier 汎用化**: Gate 0 のプロジェクト固有 electron パス分類を汎用カテゴリ（Frontend / Backend / Database / IPC / Tests / Config）に変更。Gate 5 の参照先を `.claude/rules/` → `.claude/docs/vision/coding-principles.md` に更新、known-issues/INDEX.md 参照を追記

- **session-loader グローバル化**: `~/.claude/skills/session-loader` を新設（標準構造前提の Step 1-5）。life-editor プロジェクト固有版は Step 6-7 で追加読込を担う構成に更新、旧 `docs/life-editor-v2/00-vision.md` / `docs/adr/0001-tech-stack.md` 参照を削除

- **skill-catalog.md 更新**: Software 推奨スキルに session-loader / session-verifier を追加、Novel / Research 推奨にも session-loader 追加

<!-- older entries archived to HISTORY-archive.md -->
