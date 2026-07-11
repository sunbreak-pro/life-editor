---
Status: IN PROGRESS
Created: 2026-07-11
Branch: claude/connect-refine
Owner-chat: connect-refine
Parent: 2026-07-11-layout-standard-v2.md
---

# Plan: connect-refine orders — 担当 Issue + Layout Standard v2 adoption

> connect-refine worktree の作業台帳。共通仕様の正本 = [親計画](./2026-07-11-layout-standard-v2.md)（転記しない）。担当の一次情報は常に `gh issue list -R sunbreak-pro/life-editor --label section:connect --state open` + `--label shared-fix`（本計画は 2026-07-11 時点のスナップショット + セクション固有メモ）。

boot 行:

```text
計画書 .claude/docs/vision/plans/2026-07-11-connect-refine-orders.md に従い、「今すぐ着手可」から実行してください。
```

---

## 今すぐ着手可（v2 部品を待たない）

- section:connect の open Issue は **2026-07-11 時点で 0 件**
- **#181 connect 行（v1 adoption）**: fluid variant 採用の確認（軽量）+ connect 内部ヘッダの rem gutter → px トークン（#180 Worklog の残課題）。完了したら #181 の自分の行をチェック

## Layout Standard v2 adoption（v2 共通部品 merge 後 — 親計画 Step 4 以降）

- ConnectHeader（自前の `border-b` 付きタイトルタブ）を**標準セクションヘッダーへ移行**し、MainScreen 側 sectionToolbar 経由だった rightSidebar トグル配線の重複を撤去
- **幅は全画面 wide 統一**（幅切替タブは 2026-07-11 廃止 — 親計画 §5）: connect は現状も全幅のため見た目の変化なし。全幅での表示確認のみ
- graph settings / backlinks パネルが「区切り線の下で開閉」に変わった後の表示確認

## 後続: life-tags（[兄弟計画](./2026-07-11-life-tags-unification.md)参照・着手は合図待ち）

- Connect のリンクグラフ・タグは WikiTag 基盤そのもの → **改名・拡張の影響を直接受ける**。兄弟計画の Step 2（詳細設計）にレビュー参加を想定

---

## Scope (Touchable Paths)

```
web/src/connect/**
shared/src/components/Connect/**   ← 自セクション部品のみ。shell 部品（AppShell / MainScreen / HeaderTabs / RightSidebar 系 / 標準ヘッダー）は編集禁止（単一書込者 = layout-standard）
.claude/docs/vision/plans/2026-07-11-connect-refine-orders.md
```

## Steps

| #   | Step                         | Gate    | Acceptance                              |
| --- | ---------------------------- | ------- | --------------------------------------- |
| 1   | #181 connect 行の消化        | 🤖      | #181 チェック + build/test pass         |
| 2   | v2 adoption（部品 merge 後） | 🤖 + 👀 | v2 adoption Issue の connect 行チェック |

## Acceptance Criteria

- [x] `cd shared && npm run build && npm run test` / `cd web && npm run build` pass（2026-07-11: shared build 緑・web build 緑・test は下記 Worklog 参照 = flaky 6 件除き全 pass）
- [ ] 担当分（#181 / v2 adoption #206）: v2 adoption はコード完了（下記 Worklog）。#181 行チェック・#206 close は PR merge 後
- [ ] 完了時: 本計画 Status 更新 + per-chat memory 更新（DoD）

## Worklog

- 2026-07-11: Step 1（#181 connect 行）実施。fluid variant 採用を実測確認（`web/src/MainScreen.tsx` の pageWidth 分岐で connect = "fluid" → PageContainer 経由）。#180 残課題の rem gutter を px トークン化: `ConnectHeader.tsx` の `px-4 md:px-6` → `px-lumen-gutter md:px-lumen-gutter-wide`・`ConnectGraphView.tsx` mobile ヘッダ行/レジェンド帯の `px-4` → `px-lumen-gutter`（GraphStates の空状態 px-6 / NodeDetailSheet 内側 px-4 はページ gutter でないため据え置き）。検証 = shared build + 768 tests + web build pass・role-qa PASS（越境なし・二重 padding なし）。#181 の行チェックは PR merge 後
- 2026-07-11 (2): Step 2（Layout Standard v2 adoption）実施。Issue = **#206**（section:connect で自起票）。#196 merge により connect が wide で二重ヘッダー（shell の標準 SectionHeader + body 内 ConnectHeader）になっていたのを解消。ユーザー決定（AskUserQuestion 2026-07-11: graph アクションの置き場所 = **右サイドバーに集約**）に基づき、自前 ConnectHeader を撤去しそのアクション（ノード/エッジ件数・フィルタ解除・reheat=再配置・fit=全体表示）を rightSidebar の settings タブへ移設。実装: 新規 `ConnectGraphActions.tsx`（件数 + reheat + fit + clear-filters）／ `ConnectSidebarPanel.tsx` に `settingsHeader?` スロット追加（settings タブのみ・content の上）／ `ConnectGraphView.tsx` Desktop 分岐から `<ConnectHeader>` 撤去・`settingsHeader={<ConnectGraphActions/>}` 注入／ `ConnectHeader.tsx` 削除。**mobile/narrow 分岐はバイト不変**（v2 非対象）。幅トグルは wide 一本化で退役予定のため未着手（layout-standard 後続タスク）。検証: shared build (tsc -b) 緑・web build (tsc -b --force && vite build) 緑（supabase 同梱＝正当・`web/.env.local` 有）・role-qa PASS（Blocker 0・越境なし・mobile 不変・settingsHeader が backlinks/mobile settings sheet に漏れないことを実測確認）。shared test は並行ビルドの過負荷で notes/dailies パスワードハッシュ 6 件が timeout flaky で落ちたが、2 ファイル単体再実行で **69/69 pass** = flaky 確定（Connect 無関係・main 実バグでもない）。role-qa の非 Blocker 指摘: fit にキーボード fallback なし（reheat は R キーあり・ユーザー決定に内包）／ フィルタ chip の視認性は sidebar 開時のみ／ settings タブ内境界線 2 本は cosmetic（アクション帯の区切りとしてあえて残置）。実ブラウザ確認は §7.4 に従い PR merge 後 chat-main で。**commit/PR は未実施（ユーザー承認待ち）**
