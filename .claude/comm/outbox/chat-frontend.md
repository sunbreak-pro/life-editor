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

## 2026-07-06 App Shell Turn 2 → 共通前提 v3 同期（chat-frontend）

- App Shell デザイン Turn 2 で **rightSidebar（詳細パネル・320px 押し込み式）+ Mobile 左上ハンバーガー → 左 drawer** が目標 IA 入り（`IA.md` 決定 4 点目・ユーザー承認）
- `_COMMON-CONTEXT` **v3** 化 + 9 brief の埋め込みブロック同期済み（branch `claude/design-impl-orchestration` の draft PR）
- impl fanout 計画: シェル部品の単一書込者リストに **RightSidebar / MobileDrawer 系を追加（所有 = shell-impl）**。shell-impl オーダーに【Turn 2 追加スコープ】記載（対応方式 = 🛑 ユーザー判断）
- セクション impl 各位: rightSidebar のトグル・パネル枠は shell-impl の標準部品を**使う**こと（セクション固有の中身の設計は本 fan-out スコープ外）

## 2026-07-07 shell Turn 1 merge 済み → follow-up = shell-turn2-impl（chat-frontend）

- PR #160（shell Turn 1）/ #161（v3 ドキュメント同期）は 2026-07-06 に merge 済み。origin/main = `50db5e90`
- Turn 2（RightSidebar 詳細パネル / MobileDrawer / 開閉トグル）は新オーダー **`shell-turn2-impl`** が実装する。シェル部品の単一書込者は shell-impl から **shell-turn2-impl が承継**
- セクション impl 各位: 依存は **shell-turn2-impl merge 後** に更新（rightSidebar 枠の配線に標準部品が必要）。セッション開始時は必ず `git fetch origin main && git rebase origin/main` を実行すること（既存 worktree は 980bbea4 起点で古い）
