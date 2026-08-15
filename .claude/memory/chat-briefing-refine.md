# MEMORY (chat-briefing-refine)

## 進行中

### 🔧 [briefing] 週・月・年の目標を Briefing に常設表示（#872）（着手日: 2026-08-15）

**対象**: `shared/src/components/briefing/`・`web/src/briefing/`

- 前回: role-pm でスコープ確定（推奨 = 専用ノート 1 枚に `## 週目標 / ## 月目標 / ## 年目標`。DDL ゼロで PR 1 本に収める）
- 現在: 判断 6 件を `comm/decisions/chat-briefing-refine.md` へ起票（D-20260815-briefing-1〜6）。全件に安全側の既定があるので回答を待たず着手する
- 次: `goalSections.ts` → `useGoalsDoc.ts` → `GoalsBlock.tsx` の順で実装し、宣言ブロックの直下に差す

## 直近の完了

- [briefing] Mobile の朝刊 / 夕刊ヘッダーをハンバーガー行の下へ（#879・PR #901 open） ✅（2026-08-15）
- [analytics] 「今週」カードの週バーと Work タブ週次も暦週へ（#860・PR #868 merged） ✅（2026-08-14）
- [analytics] 「今週」の窓をカレンダー週へ統一（#780・PR #820 merged） ✅（2026-08-13）

## 予定

- #901 merge 後、Mobile 幅でヘッダーの並びを実機で目視確認。worktree 側は build / 型検証までなので実ブラウザは chat-main の手番
- モバイル「今週」カードのバー並び（週初 → 週末・未来日は空バー）の実機確認（#860・merged 済み）も同じく chat-main へ引き継ぎ
