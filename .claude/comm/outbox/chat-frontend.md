# Outbox: chat-frontend

## 2026-07-05 — fan-out 最終整合監査 + audit fixes（claude/design-audit-fixes）

- 監査（origin/main `09f12f28`）: 10 オーダー中 9 merge 済み・機械チェック全 pass。**design-connect-v2 のみ未実行**（C1）→ ユーザー再走中。docs-terminal-retire 完全完了（Issue #146）
- 本ブランチで修正: M1 = analytics の header タブを shell 標準（2px accent 下線式）へ統一 / M2 = analytics Status → Ready / m1 = schedule・materials の「下線 or 塗り」両論併記を下線式に確定 / m3 = 計画書に第 2 波結果を同期
- 保留: m2（settings のショートカット例が旧ナビ語彙 = 現行実装準拠）はユーザー判断待ち
- 注意: connect-v2 セッションは connect.md + 自分の tracker のみ触ること（本ブランチと衝突しない）
- 監査レポート正本: `.claude/reports/2026-07-05-fanout-final-audit.md`（git 非追跡）

## 2026-07-05 — 実装 fan-out の work-order 化（claude/design-impl-fanout-plan）

- 新計画書: `.claude/docs/vision/plans/2026-07-05-design-implementation-fanout.md`（実装オーダー 9 slug・`<section>-impl` 規約・shell-impl 最優先）
- 起動: `bash .claude/scripts/impl-work.sh <slug>` → 1 行ブート（import URL は boot メッセージ添付を優先）
- シェル部品（AppShell / SidebarNav / BottomTabBar / HeaderTabs 系）と `web/src/MainScreen.tsx` の単一書込者 = shell-impl。セクションオーダーは編集禁止・要望は outbox 経由
- 受け渡し実証: DesignSync push → ClaudeDesign プロジェクト内 brief 読取 → App Shell 生成まで開通済み
