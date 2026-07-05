# HISTORY (chat-design-shell)

### 2026-07-05 - design-shell brief (shell.md) 新規作成

#### 概要

ClaudeDesign 画面デザイン fan-out（計画書 `2026-07-04-claudedesign-screen-design-fanout.md`）の D7 shell オーダーを実行。アプリシェル（全画面共通の外枠。desktop + mobile）の brief を `_TEMPLATE.md` 準拠で新規作成し、2026-07-05 決定の目標 IA を初めて視覚化。header タブの標準意匠を定義した（他 brief の参照基準になる）。

#### 変更点

- **新規 brief**: `.claude/docs/design/briefs/shell.md`（335 行）。`_TEMPLATE.md` §1-6 を全充足
- **IA 視覚化**: サイドバー本流 5（Schedule/Materials/Connect/Work/Analytics）+ ユーティリティ枠 2（Settings/Trash を区切り線で視覚分離）/ Mobile 固定 4 タブ（Schedule/Materials/Work/Analytics）+ More（Connect/Settings/Trash）
- **header タブ標準の定義**: 下線式（アクティブ = 2px accent 下線 + text-primary + font-medium）/ 件数バッジは意味のあるタブのみ（例 Tasks 未完数）/ Mobile はセグメントコントロールで継承。Materials・Schedule・Analytics・Connect の各 brief が参照する基準
- **§4 プロンプト**: Desktop 1440×900 + Mobile 390×844。各冒頭に `_COMMON-CONTEXT.md` v2（2026-07-05）を全文埋め込み。状態網羅（通常 / サイドバー折畳 / ⌘K open / offline / loading）
- **機械チェック pass**: v2 マーカー両プロンプト埋込 / 旧 accent hex（#1f4fff 系）0 件 / §4 code fence 内リポジトリパス 0 / 内部参照 0
- **Status**: Ready（ClaudeDesign 投入可）。self-merge 禁止・draft PR 化はユーザー merge 待ち
