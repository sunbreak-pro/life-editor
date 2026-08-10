# MEMORY (chat-refactor-core)

## 進行中

### 🔧 コア構造のリファクタリング（着手日: 2026-08-10）

**対象**: `shared/src/**` / `web/src/**` / `mcp-server/**` / CI・tsconfig 群
**計画書**: `.claude/docs/vision/plans/2026-08-10-core-refactor.md`

- 前回: 調査 → 計画書 + Issue #668〜#677 起票（PR #678 merged）
- 現在: 実装セッション 1 に着手。ルーチン Undo/Redo 配線 = PR #686（CI 緑・open）/ C1 PR 1 = mcp-server を CI へ = PR #687（open・書いた時点の実測）
- 次: C1 PR 2（web の `"strict": true` 明示 + coverage 計測）→ PR 3 準備（tests を型検査に載せた時のエラー数を計測してから可否判断）→ PR 4（TS を 4 パッケージとも ~6.0.x へ引き上げ）→ C2

## 直近の完了

- リファクタ調査（8 領域 → 64 findings → 10 クラスタ）+ 計画書 + Issue #668〜#677 起票 ✅（2026-08-10）
- Issue #586 eslint baseline 解消（PR #638/#644/#649/#653 すべて merged・Issue closed。baseline 残 = schedule 系 3 本のみ = scope 外）✅（2026-08-10）
- desktop Windows ビルド整備（Issue #529・PR #534 merged）✅（2026-08-02）

## 予定

- 実装セッション 1: #668 の残り 3 PR → #669 / #670 / #671 / #672 / #673（#673 は #675 の前提なのでセッション 1 中に必ず終わらせる）
- 実装セッション 2: 未調査領域の追加調査（計画書 §次セッションの調査計画 A-1〜A-6）→ #674 → #676(a) → #675
- merge 後に chat-main へ依頼: ルーチン undo の実ブラウザ検証（作成 / 更新 / 削除を Ctrl+Z で戻し、生成済み Event が孤児にならないこと = D-20260810-refactor-1 の条件）
