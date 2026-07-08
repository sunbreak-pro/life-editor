# HISTORY (chat-docs-issue-cleanup)

### 2026-07-08 - docs-consistency-cleanup クローズ（Phase 8）

#### 概要

PR #177 が merge され #154/#155 が自動 close されたことを実測確認。計画書を COMPLETED 化して archive へ移動し、本レーンの作業を完了した。

#### 変更点

- **計画書**: Status を COMPLETED に更新し `archive/2026-07-07-docs-consistency-cleanup.md` へ移動（計画書: archive/2026-07-07-docs-consistency-cleanup.md）
- **確認**: PR #177 MERGED（2026-07-08 12:51Z）・#154/#155 CLOSED・origin/main 再取り込み conflict 0

### 2026-07-08 - docs-consistency-cleanup Phase 0〜7 実装

#### 概要

計画書の全フェーズを実装した（メイン + サブエージェント 4 レーン・全成果物をメイン実測 grep で検収）。前提変化として、計画書 + #154/#155 対応 3 コミットは PR #169 として既に main へ届いていたことが判明。残は PR merge（Phase 8・🛑 人手）。

#### 変更点

- **Phase 0**: origin/main 13 コミットを conflict 0 で merge。🔁 findings 再検証（R-16 = 解消済み確認 / R-13〜R-15 = 修正）。D-1〜D-10 全件ユーザー確認（全推奨案 + Phase 6 認可 + D-9 Linux + D-6 変数統一）
- **Phase 1（正本系）**: CLAUDE.md / 移行 SSOT / core / coding-principles / db-conventions の矛盾 A-01〜A-15 を修正（ink→lumen・幽霊参照・DU-G 追随・Terminal 退役日明記・ADR-0005 要旨新設ほか）
- **Phase 2（plans 棚卸し）**: 13 本を Status enum 正規化のうえ archive へ移動・残置 5 本修正・_TEMPLATE に enum + DoD 行・archive/SUMMARY 役割再定義・comm/README に .session-branch 節
- **Phase 3（known-issues）**: INDEX 役割再定義（Fixed 凍結アーカイブ + 環境系台帳）・012 Fixed 確定（残課題 = #172）・INDEX 集計と個別 Status 全 26 件一致
- **Phase 4（requirements/design）**: R-01〜R-15 + A-15。旧節番号参照を現行 §0-9 へ全数更新・省略 Provider を実測 4 種で整合・サイドバー表記を「本流 5 + ユーティリティ 2」に統一
- **Phase 5（agents/skills/hooks/comm）**: ipc-validator retire（symlink 削除）・migration-validator / sync-auditor を Supabase 時代基準へ全面改訂（agents-lib 側）・frontend-react-designer の notion-* 68 箇所 lumen 化 + session-loader 参照修正（skill-lib 側）・settings.json の hook パス `${CLAUDE_PROJECT_DIR}` 統一
- **Phase 6（cross-lane・ユーザー認可済）**: merged PR 5 件（#106/#107/#109/#111/#113）の stale memory を実態同期・dev-schedule 台帳に休止注記・docs worktree prune・regen-index 実行
- **Phase 7（再発防止）**: `rules/docs-consistency.md` 新設（非複製原則 / 改名退役 sweep / plans Status enum / サブエージェント実測必須則）・CLAUDE.md §0 に非複製原則・Issue 起票 #171（Project UI 残 2 点）/ #172（012 pagination）/ #173（docs-lint）

### 2026-07-07 - docs 矛盾監査 + consistency cleanup 計画書作成

#### 概要

docs 全域（正本系 / plans / requirements+briefs / known-issues+rules+hooks / memory+構造）をサブエージェント 5 体（延べ 7 報告）で監査し、確定 findings 約 60 件を 8 フェーズの実装計画書に統合した。実装は次セッション。

#### 変更点

- **計画書**: `docs/vision/plans/2026-07-07-docs-consistency-cleanup.md` 新規作成（findings 約 60 件・8 フェーズ・判断待ち D-1〜D-10・原因分析 8 項）+ HTML ビューを `.claude/reports/` に生成（git 非追跡）
- **監査品質**: 一次報告の偽 findings 約 10 件（SectionId 除去済み説 / MCP 34 ツール説 / plans Status 捏造等）を plans 全 19 本の Status 一括実測・コード実測（taskTree.ts / tools.ts / MainScreen.tsx）で裁定・棄却
- **ブランチ状態の発見**: この枝に #154/#155 対応 docs コミット 3 つが PR 未作成のまま滞留・main は #157-#162 で 6 コミット先行（connect brief v1 問題は main で解消済み）
