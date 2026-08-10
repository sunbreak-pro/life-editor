# MEMORY (chat-refactor-core)

## 進行中

### ⏸️ Issue #586 eslint baseline 解消（着手日: 2026-08-10）

**対象**: `shared/eslint.config.js` / `shared/src/{components,hooks,context}` / `shared/tests/`

- 前回: 対象 10 ファイル分の PR 4 本を作成（#638 / #644 / #649 / #653・テスト先行・全ゲート緑）
- 現在: ユーザー merge 待ち（P-001）。#638/#644/#649 は CI 緑・#653 は CI 実行中
- 次: merge のたびに残り PR へ origin/main を取り込み eslint.config.js の衝突を解消 → 全 merge 後に #586 close（baseline 残 = schedule 系 3 本のみ・Issue コメント済）

## 直近の完了

- desktop Windows ビルド整備（Issue #529・PR #534 merged）✅（2026-08-02）
- MobileDrawer フォーカストラップ（Issue #517・PR #535 merged）✅（2026-08-02）
- Phase B Step 9（MainScreen hooks・Issue #465・PR #479 merged = DataService 分割計画 全完了・outbox 通知済み）✅（2026-07-30）

## 予定

- （なし — #586 の merge 追従のみ）
