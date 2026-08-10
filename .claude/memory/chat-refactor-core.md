# MEMORY (chat-refactor-core)

## 進行中

### 🔧 コア構造のリファクタリング（着手日: 2026-08-10）

**対象**: `shared/src/**` / `web/src/**` / `mcp-server/**` / CI・tsconfig 群
**計画書**: `.claude/docs/vision/plans/2026-08-10-core-refactor.md`

- 前回: —
- 現在: 調査完了 → 計画書 + Issue #668〜#677 起票（PR #678 open・書いた時点の実測）
- 次: 実装セッション 1 を #668（検証ゲートの穴を塞ぐ）から着手。C2 は #668 の PR 1 が入るまで着手しない

## 直近の完了

- リファクタ調査（8 領域 → 64 findings → 10 クラスタ）+ 計画書 + Issue #668〜#677 起票 ✅（2026-08-10）
- Issue #586 eslint baseline 解消（PR #638/#644/#649/#653 すべて merged・Issue closed。baseline 残 = schedule 系 3 本のみ = scope 外）✅（2026-08-10）
- desktop Windows ビルド整備（Issue #529・PR #534 merged）✅（2026-08-02）

## 予定

- 実装セッション 1: #668 → #669 / #670 / #671 / #672 / #673（#673 は #675 の前提なのでセッション 1 中に必ず終わらせる）
- 実装セッション 2: 未調査領域の追加調査（計画書 §次セッションの調査計画 A-1〜A-6）→ #674 → #676(a) → #675
- decisions キュー D-20260810-refactor-1（ルーチンの Undo/Redo を繋ぐか消すか）の回答待ち — 放置時は C（現状維持）
