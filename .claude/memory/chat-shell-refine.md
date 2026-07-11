# MEMORY (chat-shell-refine)

## 進行中

### 🔧 #197 Tauri 残骸の完全除去 Stage B+C（着手日: 2026-07-11）

**対象**: `frontend/`（削除）・`.github/workflows/build.yml`・`.ignore`・`scripts/loop-engine/check.sh`・`README.md`・`ai-context.md`・`.claude/` docs sweep
**計画書**: なし（GitHub Issue #197 が正本。棚卸し = `docs/vision/plans/2026-05-23-cleanup-and-consolidation-deletion-targets.md`）

- 前回: Stage A は PR #199 で merge 済みと確認。Stage B 検証（ビルドグラフ参照 0 / 未移植インベントリ）をサブエージェント 2 体で実測完了
- 現在: Stage B（frontend/ 690 ファイル削除）+ Stage C（docs sweep・known-issues retired 注記・SSOT チェックボックス・agents-lib 直接編集）実装完了 — commit / PR 作成中（ブランチ = claude/shell-refine-197）
- 次: PR 作成 → #197 へ Stage B 検証記録（未移植インベントリ）をコメント → outbox 報告して停止

## 直近の完了

- #229 trash Layout Standard v2 adoption（PR #234・Closes #229）✅（2026-07-11）
- #181 trash 行の実測確認 + Issue コメント消し込み（merge 後チェックは chat-main 依頼）✅（2026-07-11）

## 予定

- （なし — 自分宛 open Issue はすべて PR 化 or コメント消し込み済み）
