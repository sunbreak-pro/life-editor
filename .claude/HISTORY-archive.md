# HISTORY-archive.md - 変更履歴アーカイブ

---

### 2026-04-19 - Tipsパネル再設計 + Terminalセクション化 + LeftSidebar コンパクト化（計画書: 外部 `~/.claude/plans/leftsidebar-font-size-2px-rosy-beaver.md`）

#### 概要

Tips を「画面下部固定 / セクション 4 件のみ」から「LeftSidebar 下部のトグルボタン + 中央エリア下部の半透明オーバーレイ + サブカテゴリタブで多数件を縦スクロール表示」に刷新。Terminal は dock/resize/minimize を全削除し、TitleBar のターミナルアイコン (Undo/Redo の左隣) と `Cmd/Ctrl+J` で開閉する全画面セクション化。LeftSidebar は font-size 16px 固定 + padding/space を縮小してコンパクト化。Tips 内容は実装を 3 並列 Explore エージェントで調査して未実装機能の記述を削除し、内部用語を「右サイドバー」「鉛筆アイコン」「▶ ボタン」など分かりやすい言葉に統一。Analytics 専用 Tips も追加。en/ja 同期 (382 keys 各)、tsc / eslint（本セッション範囲）クリーン、Vitest 227 pass。

#### 変更点

- **Tips パネル UI 刷新**: `components/shared/TipsPanel.tsx` を全面書き換え。`isOpen` / `onClose` props で親制御化、`absolute inset-x-0 bottom-0 max-h-[55vh]` で中央エリア内の下部オーバーレイ配置（LeftSidebar / RightSidebar に被らない）、`bg-notion-bg-secondary/70 backdrop-blur-sm` で半透明（カード/ヘッダは不透明）、ヘッダ部にサブカテゴリタブ（横スクロール対応）+ 1 カラム縦スクロールリスト。`useLocalStorage(STORAGE_KEYS.TIPS_TAB_PREFIX + section)` でセクション別にアクティブタブを永続化
- **Tips データ構造**: `types/tips.ts` に `TipsTabDefinition` 追加（`{ id, labelKey, icon, tips: TipDefinition[] }`）。`TipsSectionId` を `schedule | work | materials | connect | terminal | analytics` の 6 セクションに拡張。`config/sectionTips.ts` を新規作成して 6 セクション × 4 タブ × 6〜10 件の Tips を `makeTip(section, tab, item, icon)` ヘルパで定義（合計 174 Tips）
- **Tips コンテンツ正確化**: 3 並列 Explore エージェントで Schedule/Materials/Connect/Work/Analytics/Terminal の実装を調査し、未実装機能の記述を削除 — Calendar 日ビュー / 月表示ドラッグ / Calendar 右クリック追加 / Calendar タグフィルタ / ルーティンスキップ / DayFlow 完了非表示 / DayFlow 複数選択編集 / Stats タブ（→ 右サイドバー Achievement パネル）/ ヒートマップ画面 / 週比較 / Materials ホバープレビュー / 壊れたリンク警告 / Connect タグ統合 / 音源リンク / ルーティンリンク / Backlink リンク昇格 / ビュー保存 / プリセットフィルタ / Work お気に入りピン / プリセット保存 / 環境音 6 種ミキサー / ヘッドホンモード / 休憩中ミュート / Terminal Cmd+F 検索 / Cmd+K クリア / CSV エクスポート（予定）。代わりに実装通りの操作（カレンダー日付の Repeat アイコン → ルーティン管理 / 右サイドバー Achievement の + ボタン / Day Flow Today ボタン / + Add Custom Sound / Sound Tags 等）に置換。内部用語（WikiTag / DayFlow 等）は「タグ」「Day Flow タブ」のように整理し、操作場所を明示（右サイドバー / Undo/Redo の左隣 / 鉛筆アイコン 等）
- **Analytics 専用 Tips 追加**: 4 タブ（Overview / Tasks / Time / Knowledge）× 各 6〜7 件。Today ダッシュボード / 期間セレクタ（右サイドバー） / 日付プリセット / 週次サマリ / Streak / 6 タブ切替 / 完了トレンド / 停滞チャート / 作業ヒートマップ / ポモドーロ達成率 / メモヒートマップ / タグ使用頻度 等を実装に沿って記述
- **Terminal セクション化**: `types/taskTree.ts` の `SectionId` に `"terminal"` 追加。`components/Terminal/TerminalSection.tsx` 新規（既存 `useTerminalLayout` / `SplitLayout` / `TerminalTabBar` を再利用、dock/resize/minimize 関連 prop を全削除した薄いラッパー）。`components/Terminal/TerminalPanel.tsx` を削除。`Layout.tsx` で TerminalSection を中央エリアに永続マウントし、`activeSection === "terminal"` のとき `display:flex` / それ以外 `display:none` で表示切替（PTY セッションを保持）
- **TitleBar Claude起動ボタン**: `components/Layout/TitleBar.tsx` に Undo/Redo の左隣に Terminal アイコンボタンを追加。クリックで `activeSection` を `"terminal"` に切替 + `launchClaude()` 実行。`SECTION_UNDO_DOMAINS` には `terminal` を未追加（Undo 対象外）
- **LeftSidebar Tips ボタン**: `LeftSidebar.tsx` / `CollapsedSidebar.tsx` の旧 [Claude 起動] 位置に [Tips] ボタン（Lightbulb アイコン）を配置 → `onToggleTips` で Tips オーバーレイをトグル。Layout から `tipsOpen` state（`useLocalStorage(STORAGE_KEYS.TIPS_OPEN)`）を渡してアクティブ表示
- **LeftSidebar コンパクト化**: 全メニューボタンを `style={{ fontSize: 16, lineHeight: 1.25 }}` に固定（旧 `text-scaling-sm` から脱却）、`py-2` → `py-1.5`、`space-y-1` → `space-y-0.5`、`p-3` → `p-2`、Timer ミニ表示の padding/フォントも同調縮小。アイコンは 18px 維持
- **Storage Keys 整理**: `TERMINAL_OPEN` / `TERMINAL_HEIGHT` / `TERMINAL_DOCK` / `TERMINAL_WIDTH` / `TIPS_COLLAPSED` を削除。`TIPS_OPEN` / `TIPS_TAB_PREFIX` を追加
- **Layout 統合**: dock 関連 state / 分岐ロジックを全削除して中央エリア構造を `flex-col` に単純化。`launchClaude` の実装を「セクション切替 + Claude コマンド送信」に簡素化（旧: terminal 開閉 + Claude 起動）。`view:toggle-terminal` キーボードショートカットを `activeSection` 切替ベースに変更（previousSectionRef で復元先を記憶）
- **App.tsx**: `terminalCommandRef` を Layout に渡すよう更新、`renderContent()` の switch に `case "terminal": return null` 追加（実体は Layout 内に永続マウント）
- **i18n**: en/ja 両方で `tips.*` ブロックを完全置換（370 参照キー、382 公開キー、両言語完全一致）。`sidebar.tipsButton`, `sidebar.launchClaude` 維持。jq でマージして JSON 整合性を確認
- **検証**: `tsc --noEmit -p tsconfig.app.json`（本セッション範囲エラーなし、pre-existing 2 件は IdeasView / MobileRichEditor）/ `npm run lint`（本セッション範囲エラーなし）/ `vitest run` 27 → 28 ファイル、222 → 227 pass
