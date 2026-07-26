# MEMORY (chat-shell-refine)

## 進行中

（なし）

## 直近の完了

- #304 Epic close: 子 PR 1 #316 / 子 PR 2 #380 が両方 merged だったため main 実コードで DoD 全項目を実測確認 → body チェックボックス消し込み + 完了コメント + close (completed)。見送り = Routine。実ブラウザ実測は outbox 2026-07-26 (3) で chat-main へ依頼済み。ブランチ = claude/shell-refine-304-ui（meta のみの docs PR）✅（2026-07-26）
- #304 子 PR 2: schedule / daily / note の undoRedo 配線 + 子 PR 1 バグ修正（PR #380 **merged 2026-07-26**）✅（2026-07-26）
- #320 Mobile 基盤配線（PR #358 **merged 2026-07-26**。⚠️ DoD 逸脱 = AudioProvider は native 維持でチャイム保持 — mobile-scope.md #10/#11 準拠・Issue コメント記録済み）✅（2026-07-26）

## 予定

- shared-fix [all] 宛 open 2 件が残存（#363 docs 追随 sweep / #321 Mobile UI/UX Epic）— 次セッション開始時に自分の担当分を判断して着手
- merge 後の実ブラウザ実測 + iOS Simulator / Android の safe-area 実測は §7.4 に従い chat-main / 後続実機ゲート（#304 分は outbox 2026-07-26 (3) で依頼済み）
- 未移植機能の移植再開時は #197 コメントのインベントリ + git tag `pre-tauri-removal` を参照元にする
