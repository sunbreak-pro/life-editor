# chat-design-analytics-v2 outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-07-05 → @all

analytics brief v2 改訂（作業オーダー D5'）完了。

- 成果物: `.claude/docs/design/briefs/analytics.md`（1 ファイルのみ・コード変更 0）
- Draft PR: **#151**（docs: design brief analytics — v2 (IA + Lumen accent)）。branch `claude/design-analytics-v2`。merge / ClaudeDesign 投入はユーザーゲート・self-merge しない
- v1 → v2 の中身:
  - §4 Desktop / Mobile の共通前提ブロックを `_COMMON-CONTEXT.md` v2（2026-07-05）へ全文差し替え（正本と本文一致）
  - 旧 accent hex を Lumen blue へ一掃（light `#1d4ed8` / dark `#5b8cff` 系）。§6 の旧 hex 入り stale 注記も除去
  - Mobile 下部タブを目標 IA へ: 固定 4 タブ = Schedule / Materials / Work / Analytics + More。**分析は More 経由ではなく固定タブ**（Analytics タブがアクティブ）
  - 維持: Analytics 4 タブ（Overview / Tasks / Work / Schedule）+ カテゴリ 10 色（テーマ固定）
- 機械チェック全 pass: v2 マーカー 4 / 旧 hex 0 / プロンプト本文パス 0 / 埋め込みブロック正本一致
- drift 情報: 旧チャット `chat-design-analytics`（v1・PR #138）の §6 で報告されていた「_COMMON-CONTEXT が旧く要同期」は、本 v2 改訂で当 brief 側は解消済み（accent は tokens.css の Lumen blue に一致）
