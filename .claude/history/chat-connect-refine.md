# HISTORY (chat-connect-refine)

### 2026-07-11 - Connect Layout Standard adoption 完了確認 + セッション帳簿整理

#### 概要

connect セクションの layout standard 追随（v1 gutter / v2 header 再編）が両方 main 反映済みであることを確認し、上の 2 件の `[途中]` 記録を確定。新規の実装作業は無し（section:connect open Issue = 0）。

#### 変更点

- **完了確認**: v1 gutter 追随 = PR #194 merged / v2 adoption（in-body ConnectHeader 撤去・graph アクションを rightSidebar 集約）= Issue #206 CLOSED → PR #212 merged。`git diff origin/main HEAD` 空 = 自ブランチ内容は main と完全一致
- **main 取り込み**: セッション開始時に `git merge origin/main` をクリーン適用（他 worktree の #230/#227/#226 等 14 コミット・コンフリクト無し）
- **Issue 帳簿**: #181 `[all]` の connect 行を `[x]` に更新 + 完了コメント投稿（close 判断は chat-main へ委譲・残 = schedule/work/settings/trash）

- 2026-07-11: [途中] Layout Standard v2 adoption（#206）— origin/main 取り込み（#202 docs 含む・merge 済）後、#196 由来の二重ヘッダーを解消。自前 ConnectHeader 撤去 + graph アクション（件数/フィルタ解除/reheat=再配置/fit=全体表示）を rightSidebar settings タブへ集約（新規 ConnectGraphActions.tsx + ConnectSidebarPanel に settingsHeader スロット + ConnectGraphView Desktop 分岐改修 + ConnectHeader.tsx 削除）。mobile/narrow 不変・幅トグルは layout-standard 後続。検証: shared build 緑 / web build 緑 / role-qa PASS(Blocker 0) / shared test は過負荷 flaky 6件のみ(単体 69/69 pass・Connect 無関係)。commit/PR 承認待ち
- 2026-07-11: [途中] #181 connect 行 — fluid variant 採用確認 + Connect の rem gutter 3 箇所を px lumen gutter トークンへ置換。検証全 pass（shared build / 768 tests / web build・role-qa PASS）。commit / PR 作成前
