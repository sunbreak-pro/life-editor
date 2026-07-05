# HISTORY (chat-design-analytics-v2)

### 2026-07-05 - analytics brief v2 改訂（D5'）

#### 概要

design fan-out 計画の作業オーダー `design-analytics-v2`（D5'）を実行。`briefs/analytics.md` を v1 → v2 へ改訂し、draft PR まで到達。コード変更なし・成果物 1 ファイルのみ。

#### 変更点

- **共通前提の v2 差し替え**: §4 の Desktop / Mobile 両プロンプト冒頭の共通前提ブロックを `_COMMON-CONTEXT.md` の v2（2026-07-05）へ全文差し替え（要約なし・正本と本文一致）
- **旧 accent hex 一掃**: `#1f4fff`→`#1d4ed8` / `#1a42d9`→`#1e40af` / `#e1e6fb`→`#dbeafe` / dark `#5b82ff`→`#5b8cff` / `#7596ff`→`#7aa2ff` / task チップ `#e3e7ff`→`#dbeafe`・`#2330b0`→`#1e40af`。§6 の旧 hex を含む stale 注記も除去
- **ナビを目標 IA へ**: Mobile 下部タブを「Tasks/Daily/Notes/Schedule + More（分析は More 経由）」→ 目標 IA の固定 4 タブ「Schedule / Materials / Work / Analytics + More」に修正。分析は固定タブの一つ＝ Analytics タブがアクティブに。Desktop 画面骨格もサイドバー本流 5 + ユーティリティ枠 表現へ。Analytics 4 タブ（Overview/Tasks/Work/Schedule）とカテゴリ 10 色は維持
- **§6 注記の解消**: 「\_COMMON-CONTEXT が旧く要同期」の警告を「v2 同期済み」へ更新。§5 AC に IA 整合の項目を追加
- **機械チェック**: v2 マーカー 4 件 / 旧 hex 0 件 / プロンプト本文にリポジトリパス無し / 共通ブロック正本一致（全て pass）
