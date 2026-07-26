# MEMORY (chat-shell-refine)

## 進行中

### ⏸️ #304 Epic: アプリ操作の Undo/Redo 有効化（着手日: 2026-07-20・子 PR 2 まで完了）

**対象**: shared UndoRedo 基盤 + 各 API フックの undoRedo? 引数 + ヘッダー UI（参照 = git tag pre-tauri-removal）

- 前回: 子 PR 2 = **PR #380**（Part of #304・open = merge 待ち）。schedule / daily / note の ambient auto-connect 配線 + **子 PR 1 の実バグ修正同梱**（unmount クリア effect が push 直後に履歴を消す — main の taskTree undo が実質無効だった）+ schedule 日跨ぎ表示不整合修正（dateRef）+ i18n 新規 13 キー + テスト 6 件
- 現在: PR #380 merge 待ち（merge = こうだいさん）。Routine 見送り・Daily 暗黙作成 / moveNote snapshot の既知挙動は Issue #304 コメントに記録済み
- 次: merge 後の実ブラウザ実測は chat-main（§7.4）。DoD はコード側完了 — Epic close 判断は merge + 実測後

## 直近の完了

- #304 子 PR 2: schedule / daily / note の undoRedo 配線 + 子 PR 1 バグ修正（PR #380・Part of #304・**open = merge 待ち**。ブランチ = claude/shell-refine-304-domains）✅（2026-07-26）
- #320 Mobile 基盤配線（PR #358・Closes #320・**open = merge 待ち**。ShortcutConfigHost / mixer native 省略 / viewport-fit=cover / platform.test.ts 新設。⚠️ DoD 逸脱 = AudioProvider は native 維持でチャイム保持 — mobile-scope.md #10/#11 準拠・Issue コメント記録済み。ブランチ = claude/shell-refine-320）✅（2026-07-26）
- #304 子 PR 1: Undo/Redo 基盤 + taskTree（PR #316 **merged**）✅（2026-07-20）

## 予定

- PR #358 / #380 の merge = こうだいさん操作。⚠️ 両 PR は per-chat meta 3 ファイル（memory / history / outbox の chat-shell-refine）で衝突する — **#380 側が superset なので解消は常に「#380 側を採る」**（推奨順 = #358 → #380。#358 merge 後に当チャットが #380 側で origin/main を merge して解消可能）
- merge 後の実ブラウザ実測 + iOS Simulator / Android の safe-area 実測は §7.4 に従い chat-main / 後続実機ゲート
- 未移植機能の移植再開時は #197 コメントのインベントリ + git tag `pre-tauri-removal` を参照元にする
