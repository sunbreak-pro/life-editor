# MEMORY (chat-docs-workspace)
> RETIRED: 2026-08-30 — worktree 廃止・書き手不在（D-20260830-main-1）

## 進行中

（なし）

## 直近の完了

- Issue #319: mobile 機能限定の要件定義 — 実測ベースで論点表作成（8セクション×機能・全 file:line 検証）→ ユーザー選択式2ラウンドで全17行のスコープ確定（Notes フル編集 / tasks 詳細編集 / schedule Routines 閲覧 = Phase 2、briefing 朝夕切替+宣言入力 = Phase 1、Undo・Redo+コマンド検索 = Phase 2、Ambient mixer = Desktop専用）→ `.claude/docs/requirements/mobile-scope.md` 新設 + CLAUDE.md §2 参照。PR #324（docs/mobile-scope-319 → main・Fixes #319・merge 待ち）。別枠: 「Mobile 省略 Provider」記述が実装と乖離 → 別 Issue 起票依頼を outbox へ ✅（2026-07-25）
- Issue #257: `tier-1-core.md` に Briefing requirements 節を追加（正本ポインタ = `2026-07-15-briefing-loop.md`・紙面ブロック / `extractBriefing` 規約 / 夕刊規約（Evening alias・1 行成立・「気分: n/5」）を要件化。CLAUDE.md §8「追って追加」注記解消・briefing-loop References/Worklog 追随・数値の非複製原則で個数参照を整理）→ commit 630cad69 / PR #267 merged（2026-07-25 origin/main で確認・#257 close 済）✅（2026-07-17）
- ループ摩擦除去計画書 `2026-07-16-loop-friction-fixes.md` 新設（ユーザー要件 6 件 + 第 2 ラウンドの夕刊専用ページ → 実測精査 + 決定 7 件確定。重要発見 = 手書き朝刊・夕刊は Daily 平文 textarea のため現状不成立 → F-1 Daily TipTap 化が Step 2 と並ぶループ開通の前提。F-6 = 夕刊専用ページ（保存先 = Daily のまま・F-1 依存）。briefing-loop 決定録 5〜6 / tier-3 Analytics「破棄しない」追記・outbox 起票依頼 6 件 F-1〜F-6）→ PR #254 merged（2026-07-17 確認）✅（2026-07-16）

## 予定

- v2 Issue 2 枚（`[layout-standard]` 共通部品 / `[all]` adoption）の起票は Issue 駆動 dispatch 移行（2026-07-11 (2)）により chat-main の担当へ移管 — 本チャットは自分宛ラベルの Issue を待つ
- life-tags 親計画の Step 2（詳細設計追記）— layout v2 共通部品 merge 後
