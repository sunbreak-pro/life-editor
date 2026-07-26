# MEMORY (chat-shell-refine)

## 進行中

### 🔧 #304 Epic: アプリ操作の Undo/Redo 有効化（着手日: 2026-07-20・子 PR 1 merge 済み）

**対象**: shared UndoRedo 基盤 + 各 API フックの undoRedo? 引数 + ヘッダー UI（参照 = git tag pre-tauri-removal）

- 前回: 子 PR 1（基盤 + taskTree）= PR #316 **merge 済み**。UndoRedoManager グローバル1本スタック + Provider + Buttons + Toast + ⌘Z 配線 + taskTree auto-connect + 単体13件
- 現在: 子 PR 2 = 残ドメイン（schedule / daily / note）の undoRedo 配線に着手 — `claude/shell-refine-304-domains` へのブランチ切替（+ .session-branch 更新）から
- 次: 参照実装 = `shared/src/context/TaskTreeContext.tsx`（セクション層 unmount 時の stack clear 含む）で 3 ドメイン配線。Routine は複雑なら見送り可（見送り範囲を Issue コメントに明記）

## 直近の完了

- #320 Mobile 基盤配線（PR #358・Closes #320・**open = merge 待ち**。ShortcutConfigHost / mixer native 省略 / viewport-fit=cover / platform.test.ts 新設。⚠️ DoD 逸脱 = AudioProvider は native 維持でチャイム保持 — mobile-scope.md #10/#11 準拠・Issue コメント記録済み。ブランチ = claude/shell-refine-320）✅（2026-07-26）
- #304 子 PR 1: Undo/Redo 基盤 + taskTree（PR #316 **merged**）✅（2026-07-20）
- #306 ヘッダー常設コマンドパレット検索フィールド（PR #315 **merged**）✅（2026-07-20）

## 予定

- PR #358 の merge = こうだいさん操作。merge 後の実ブラウザ実測 + iOS Simulator / Android の safe-area 実測は §7.4 に従い chat-main / 後続実機ゲート
- 未移植機能の移植再開時は #197 コメントのインベントリ + git tag `pre-tauri-removal` を参照元にする
