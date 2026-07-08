---
Status: Review
Created: 2026-07-08
Branch: claude/materials-impl
Owner-chat: materials-impl
Parent: .claude/docs/vision/plans/2026-07-05-design-implementation-fanout.md
---

# Plan: Materials — target IA implementation (ClaudeDesign import)

> Work order "materials-impl"（fan-out 計画書）の mini-plan。Materials セクションの 4 タブ
> （Tasks / Notes / Daily / Tags）を ClaudeDesign 生成デザイン（8 キャンバス: 各タブ × Desktop/Mobile）
> と materials brief（`.claude/docs/design/briefs/materials.md`）準拠に再実装する。

---

## Context

- **動機**: 目標 IA（`.claude/docs/design/IA.md`）で Materials は 1 セクション 4 タブに統合済み（shell Turn 1/2 で配線完了）。タブの中身（4 ビュー）が旧デザインのままなので、Lumen 意匠 + rightSidebar 詳細パネル活用 + Mobile 責務削減へ揃える。
- **デザイン原本**: DesignSync project `4ed22c22-…` から import 済み（scratchpad/design-imports/ に 8 ファイル保存。`Materials_{Tasks,Notes,Daily,Tags}[_Mobile].dc.html`）。空/ローディング状態はデザイン未生成 → brief §3 の標準（スケルトン同形・スピナー禁止・EmptyState 縦積み）で補完する。
- **制約**: コスト $0 / シェル部品と `web/src/MainScreen.tsx` は shell-turn2-impl 所有で**編集禁止**（変更要望は outbox へ）/ `lumen-*` トークン必須・新規コードに hex 直書き禁止 / i18n は props 注入・en/ja 両 catalog / DataService はコールバック注入（ビューは context 経由のみ）。
- **Non-goals**: MainScreen のタブ行改修（CTA のタブ行内配置は shell 側スロット追加待ち）/ Mobile での DnD・横カラム・色編集・タグ/フォルダビュー（brief の責務削減）/ Routine 専用 UI / トークン実値変更。

### デザイン → 実装のずれ（規約優先の差分宣言）

1. **新規作成 CTA の位置**: デザインはタブ行右端（PanelRight トグルの左）だが、タブ行は MainScreen 所有で編集禁止。→ **各タブのコンテンツ先頭のアクション行右端**に置く（Tasks は KanbanBoard の `headerActions` slot に統合）。shell-turn2-impl へ「materials 用 trailing slot（例: portal target）」の追加要望を outbox に記録し、追いつき時にタブ行へ昇格。
2. **Mobile のページタイトルヘッダー**（ハンバーガー + "Materials" 22px + "+"）はデザイン上シェル領域。現行シェル標準（ハンバーガー + SegmentedControl の 1 行）を維持し、CTA は同じくビュー内アクション行に置く。
3. ステータス固定色（#38bdf8 等）・チップ配色は既存トークン `lumen-status-{todo,progress,done}-band` / `lumen-chip-*` を使用（hex 直書きしない）。

---

## Scope (Touchable Paths)

```
shared/src/components/**          # 新規 materials 部品 + barrel（シェル所有物を除く — 下記）
shared/src/i18n/locales/en.json   # 新規キー追加のみ
shared/src/i18n/locales/ja.json   # 新規キー追加のみ
shared/tests/**
web/src/tasks/**
web/src/notes/**
web/src/daily/**
web/src/wikitag/**
.claude/docs/vision/plans/2026-07-08-materials-impl.md
.claude/memory/chat-materials-impl.md
.claude/history/chat-materials-impl.md
.claude/comm/outbox/chat-materials-impl.md
```

**編集禁止（shell-turn2-impl 所有）**: `web/src/MainScreen.tsx` / `shared/src/components/{AppShell,SidebarNav,NavItem,BottomTabBar,HeaderTabs,SegmentedControl,RightSidebar,RightSidebarContents,RightSidebarPortal,RightSidebarToggle,MobileDrawer}.tsx` / `shared/src/context/RightSidebar*` / `shared/src/styles/tokens.css`（トークン実値変更は 🛑。新トークン追加は今回不要見込み — 必要になったら追加のみ可）。
`shared/src/components/index.ts` は共有バレル（シェル専有ではない）— **追記のみ**・既存行は触らない。

---

## 設計判断（要点）

- **rightSidebar 活用（Desktop のみ）**: 各ビューは `isWide`（`useMediaQuery("(min-width: 768px)")`）のとき `RightSidebarPortal` で詳細 UI を注入する。narrow では portal を張らず（MobileDrawer との二重化回避）、Mobile 固有導線（BottomSheet 等）を使う。
  - Tasks: 既存 `TaskDetailPanel` を portal 内カードで再利用（タグ行 slot を additive に追加）。カード選択で自動 open。
  - Notes: 新 `NoteDetailPanel`（タイトル/ピン/削除/タグチップ/内容 editor slot/リンク一覧）。
  - Daily: 新 `DailyEntriesPanel`（今日/昨日 2 分割・日付ピッカー・エントリ抜粋リスト）。
  - Tags: 新 `TagGroupsPanel`（グループカード + メンバーチップ + 「+ タグを追加」破線ピル）。
- **Mobile 責務削減**（brief 準拠）: Tasks = StatusFilterChips + 縦 1 カラム + タップで 60% BottomSheet（3 択ステータス）+ QuickAddSheet ／ Notes = 閲覧（92% Sheet）+ 最短追加のみ・ロック解除維持 ／ Daily = DateStrip（直近 2 週間）+ 今日エディタ + 過去抜粋 ／ Tags = 閲覧 + 最短追加・グループは折りたたみ閲覧のみ。
- **状態系の補完**: 各タブに同形スケルトン（`SkeletonList`）と `EmptyState`（lucide アイコン 24-28px text-tertiary + 1 行 + accent CTA 縦積み）。
- **i18n 追い付き**: DailyView / WikiTagsManagementView は現在ハードコード文言 → 全て t() 化し en/ja 両 catalog に追加（新 namespace `materials.*` 配下 + 既存 namespace 再利用）。
- **タブ切替の状態保持**: MainScreen が条件レンダリングでアンマウントするため、軽量 UI 状態（Kanban viewMode は既存 localStorage 済 / Notes 選択 note・Tasks モバイルフィルタ等）は module-scope or localStorage で復元（nice-to-have、AC 外）。

### 新規 shared 部品（純プレゼンテーション・copy/props 注入・テスト付き）

| 部品                | 置き場                | 用途                                                     |
| ------------------- | --------------------- | -------------------------------------------------------- |
| `EmptyState`        | components/（汎用）   | 空状態標準（アイコン+1行+CTA）                           |
| `SkeletonList`      | components/（汎用）   | 同形スケルトン行（スピナー禁止）                         |
| `StatusFilterChips` | components/materials/ | Mobile Tasks の丸ピル 3 択フィルタ（件数付き）           |
| `ExcerptListItem`   | components/materials/ | タイトル+抜粋 2 行リスト行（Notes Mobile / Daily 過去）  |
| `DateStrip`         | components/materials/ | Daily Mobile の日付チップ行（エントリ有無ドット）        |
| `QuickAddSheet`     | components/materials/ | BottomSheet + Input + 送信の最短追加シート               |
| `TagRow`            | components/materials/ | タグ行 36px（色ドット+#名前+件数+hover アクション）      |
| `TagGroupCard`      | components/materials/ | グループカード（Desktop 編集可 / Mobile 折りたたみ閲覧） |
| `NoteDetailPanel`   | components/materials/ | Notes 詳細（rightSidebar 用）                            |
| `DailyEntriesPanel` | components/materials/ | Daily 過去エントリ（rightSidebar 用）                    |
| `TagGroupsPanel`    | components/materials/ | Tags グループ管理（rightSidebar 用）                     |

---

## Steps

| #   | Step                                                                                                                                                                     | Gate           | Acceptance                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | ----------------------------------------------- |
| 1   | 共有プリミティブ batch（EmptyState / SkeletonList / StatusFilterChips / ExcerptListItem / DateStrip / QuickAddSheet + barrel + tests）                                   | 🤖             | `cd shared && npm run build && npm run test` 緑 |
| 2   | Tasks タブ（Desktop: Kanban 意匠合わせ + CTA 行 + portal 詳細（TaskDetailPanel+タグ slot）/ Mobile: チップフィルタ+縦リスト+ステータス Sheet+QuickAdd / 空・スケルトン） | 🤖             | shared+web build 緑・kanban 系 test 緑          |
| 3   | Notes タブ（Desktop: 中央 800px ツリーカード+検索+ゴミ箱行+NoteDetailPanel portal / Mobile: ピン留め+グループ一覧+92% 閲覧 Sheet+QuickAdd）                              | 🤖             | build 緑・notes 系 test 緑                      |
| 4   | Daily タブ（Desktop: 中央エディタカード+DailyEntriesPanel portal+「今日へ」/ Mobile: DateStrip+エディタ+過去抜粋 / i18n 全面追い付き）                                   | 🤖             | build 緑・daily 系 test 緑                      |
| 5   | Tags タブ（Desktop: 中央タグ一覧カード+TagRow+TagGroupsPanel portal+ColorPicker / Mobile: 閲覧リスト+折りたたみグループ+QuickAdd / i18n 追い付き）                       | 🤖             | build 緑・tags 系 test 緑                       |
| 6   | 仕上げ検証（en/ja キー同数・hex grep 0・全 build/test・session-verifier）→ role-qa（別コンテキスト監査）                                                                 | 🤖             | 下記 AC 全て yes                                |
| 7   | tracker END → draft PR `feat: materials — target IA implementation (ClaudeDesign import)` → outbox 報告                                                                  | 🤖（作成まで） | PR URL 取得                                     |
| 8   | 目視確認（4 タブ × wide/narrow、light/dark）                                                                                                                             | 👀             | ユーザー確認                                    |
| 9   | PR merge                                                                                                                                                                 | 🛑             | ユーザー操作（self-merge 禁止）                 |

コミットはタブ単位（Step 単位）で分割。`git add` は pathspec 明示（`-A` 禁止）。

---

## Acceptance Criteria (機械検証可能)

- [ ] `cd shared && npm run build` exit 0
- [ ] `cd shared && npm run test` 全 pass（新規部品のテスト含む）
- [ ] `cd web && npm run build` exit 0
- [ ] 変更/新規ファイルに hex 色直書き 0（`git diff main --name-only` の .tsx/.ts に対する `#[0-9a-fA-F]{3,8}` grep。ユーザーデータ色の CSS var 受け渡しは除外）
- [ ] en.json / ja.json の新規キー集合が一致（片側欠落 0）
- [ ] `git diff main --name-only` にシェル所有ファイル（MainScreen.tsx / AppShell / HeaderTabs / SegmentedControl / RightSidebar* / MobileDrawer / BottomTabBar / SidebarNav / NavItem / tokens.css）が**含まれない**
- [ ] ビュー内から `getDataService()` 直呼びなし（context 経由のみ）
- [ ] draft PR 作成済み（タイトル固定・base main）
- [ ] PR diff 目安 ±6000 行以内（最重量オーダーのため大きめ。超過時は Worklog に理由記録）

---

## Risks / Known Issues 参照

- サブエージェント完了通知の先行（memory `subagent_premature_completion`）→ 各 Step 後に git log / ファイル実在で実体検証。
- worktree の dotenv 欠落による supabase 誤 tree-shake（memory `worktree_supabase_treeshake`）→ web build は型検証目的。ログイン動作の検証はしない。
- 共有バレル `shared/src/components/index.ts` は並行チャットも触りうる → 追記のみ・コンフリクト時は再取込。

## References

- Work order: `.claude/docs/vision/plans/2026-07-05-design-implementation-fanout.md`
- Brief: `.claude/docs/design/briefs/materials.md` / IA: `.claude/docs/design/IA.md`
- デザイン原本: `<scratchpad>/design-imports/Materials_*.dc.html`（8 ファイル）
- 規約: `.claude/rules/frontend.md`（Pattern A / lumen トークン / IME）

---

## Worklog

- 2026-07-08: プラン作成。デザイン 8 ファイル import 完了（DesignSync 経由・claude_design MCP 不在のため代替）。既存 API マップ調査完了（4 ビューは web/src 側・RightSidebarPortal 未使用・Daily/Tags は i18n 未対応と判明）。CTA タブ行配置はシェル凍結のためビュー内アクション行へ（差分宣言 #1）。
- 2026-07-08: Step 1-5 実装完了（role-engineer 逐次 5 体・タブ単位 commit: 38731693 / 914e6562 / 699ada28 / 1b59a7ad / 3ac5dbcf）。新規 shared 部品 9 種 + Kanban 意匠合わせ + 4 ビュー再構成 + i18n 追い付き（en/ja 各 1961 キーで parity 維持）。
- 2026-07-08: 実装中の追加判断 — Daily はデザイン準拠でタグ/リンク UI・Trash 復元 UI・Save ボタンを撤去（blur 保存 + 保存済み表示へ。データは残置・復元は Trash セクション経由）/ Notes Mobile の抜粋は LIST が body 抜きのため省略（タイトルのみ・タップで hydrate 後に閲覧シート）/ Tags の per-tag 使用件数は unified context に tag→item 集約が無く N+1 になるため省略（フックへの `allAssignments` 追加は別タスク候補）/ TagGroupsPanel にグループ rename/delete は未実装（デザイン非掲載・要ユーザー確認）。
- 2026-07-08: role-qa 独立監査 → FAIL（Blocking 1: Mobile Notes 閲覧が hydrate 前に空 mount / Major 1: Daily blur 保存の空エントリ量産 / Minor 3）。修正 commit 2eacc47c で B-1/M-1/Mi-2/Mi-3/Mi-4 対応。Mi-1（TaskDetailModal デッドコード撤去）は barrel export 削除 = API 破壊のため見送り・フォローアップ Issue 化予定。機械 AC は全て緑（hex 0 / getDataService 直呼び 0 / parity 0 差分 / shared build+test 627 pass / web build 成功。「シェル所有ファイルが diff に出る」件はローカル main ref が stale なだけで実ベース f04e7f08 比では 0 件）。
