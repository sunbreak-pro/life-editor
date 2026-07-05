# Outbox — chat-design-schedule-v2

> 自分の Outbox（append-only）。他チャットへの共有・完了報告を時系列で追記する。

## 2026-07-05 — design-schedule-v2 完了（draft PR #144）

work-order **design-schedule-v2**（旧 D1'）= schedule design brief の v2 改訂を完了し、draft PR #144 を作成しました。

- 変更: `.claude/docs/design/briefs/schedule.md` 1 ファイルのみ（コード変更 0）
- 共通前提ブロックを `_COMMON-CONTEXT.md` の **v2** へ全文差し替え / 旧 accent 系 hex を Lumen blue（`#1d4ed8` 系）へ一掃（旧 hex 機械チェック 0 件で pass）
- 目標 IA 反映: Mobile 下部タブ 4（Schedule / Materials / Work / Analytics + More）/ Schedule を header タブ **Calendar / Routines** へ再編 / CalendarView（フォルダ別カレンダー CRUD）は Calendar タブ歯車 → 軽量モーダルに畳む提案を §3 に追加
- Status: **Ready**（ClaudeDesign 投入可）。Gate 🛑 merge・ClaudeDesign 投入はユーザー（self-merge していません）

> shell brief（D7）が header タブの標準意匠を定義する前提。本 brief の Calendar / Routines タブ形状は shell brief 側の標準を参照する記述にしてあります。
