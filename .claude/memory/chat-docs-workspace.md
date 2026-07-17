# MEMORY (chat-docs-workspace)

## 進行中

（なし）

## 直近の完了

- Issue #257: `tier-1-core.md` に Briefing requirements 節を追加（正本ポインタ = `2026-07-15-briefing-loop.md`・紙面ブロック / `extractBriefing` 規約 / 夕刊規約（Evening alias・1 行成立・「気分: n/5」）を要件化。CLAUDE.md §8「追って追加」注記解消・briefing-loop References/Worklog 追随・数値の非複製原則で個数参照を整理）→ commit 630cad69 / PR #267 open・merge 待ち（merge で #257 自動 close）✅（2026-07-17）
- ループ摩擦除去計画書 `2026-07-16-loop-friction-fixes.md` 新設（ユーザー要件 6 件 + 第 2 ラウンドの夕刊専用ページ → 実測精査 + 決定 7 件確定。重要発見 = 手書き朝刊・夕刊は Daily 平文 textarea のため現状不成立 → F-1 Daily TipTap 化が Step 2 と並ぶループ開通の前提。F-6 = 夕刊専用ページ（保存先 = Daily のまま・F-1 依存）。briefing-loop 決定録 5〜6 / tier-3 Analytics「破棄しない」追記・outbox 起票依頼 6 件 F-1〜F-6）→ PR #254 merged（2026-07-17 確認）✅（2026-07-16）
- briefing テーマの正本計画書 `2026-07-15-briefing-loop.md` 新設（ビジョン話し合い → 決定 4 件: 夕刊 = Daily「夕刊」見出し / Claude 分析 = 定時自動路線 / 完成の定義 = 平日 5 日連続でループ完走 / 本書 = briefing 正本。CLAUDE.md §8 Tier 1 に Briefing 追記 (6)→(7)・outbox に chat-main 宛起票依頼 2 件）→ PR #253 merged（2026-07-16 確認）✅（2026-07-16）

## 予定

- v2 Issue 2 枚（`[layout-standard]` 共通部品 / `[all]` adoption）の起票は Issue 駆動 dispatch 移行（2026-07-11 (2)）により chat-main の担当へ移管 — 本チャットは自分宛ラベルの Issue を待つ
- life-tags 親計画の Step 2（詳細設計追記）— layout v2 共通部品 merge 後
