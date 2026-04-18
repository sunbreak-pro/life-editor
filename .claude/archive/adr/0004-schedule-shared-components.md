# ADR-0004: Tasks/Schedule/shared/ 命名規約

## Status: Accepted

## Date: 2026-04-05

## Context

`Tasks/Schedule/Calendar/` 内の一部コンポーネント（RoleSwitcher, TimeGridTaskBlock, DateTimeRangePicker）が Calendar 以外の5つ以上のディレクトリから参照されていた。Calendar 固有ではなく Schedule 共通のコンポーネントだった。

## Decision

複数の Schedule サブディレクトリ（Calendar, DayFlow, Routine）から参照されるコンポーネントは `Tasks/Schedule/shared/` に配置する。

### 配置基準

- 1つのサブディレクトリからのみ参照 → そのサブディレクトリ内に留める
- 2つ以上のサブディレクトリから参照 → `Tasks/Schedule/shared/` に移動

### 現在の shared/ 内容

- `RoleSwitcher.tsx` — エンティティ種別切替UI
- `TimeGridTaskBlock.tsx` — タイムグリッド上のタスクブロック
- `DateTimeRangePicker.tsx` — 日時範囲選択
- `ProgressSection.tsx` — 進捗表示セクション

## Consequences

- Calendar 内に Schedule 共通コンポーネントが混在しない
- import path が意図を反映（`../shared/` = Schedule全体で共有）
- 新しいScheduleコンポーネント追加時の判断基準が明確
