-- goals_payload.start_date / end_date — a goal's own date range
-- (Issue #2366)
--
-- WHY: 目標の期間は年・月・週の 3 種類の固定で、期間は period_key（年 = YYYY /
--   月 = YYYY-MM / 週 = 日曜の YYYY-MM-DD）からしか決まらなかった。#2366 で
--   「開始日と終了日を自由に決めて目標を作れる」ようにする。
--
--   期間の種類（period_kind）と鍵（period_key）はそのまま残し、範囲は別の 2 列で
--   持つ。種類は年 → 月 → 週の親子の段（goalMapper の GOAL_PARENT_KIND）と、
--   達成の判定（judgeGoals）の数え方を決めているので、外すと木の形と進み具合の
--   両方を作り直すことになる。範囲は「その目標をいつ出すか」だけを変える:
--   範囲を持つ目標は、今日が範囲に入っている間、作った期間が過ぎても木に出る
--   （shared/src/components/goalTree/buildGoalTreeModel.ts の inPeriod）。
--
--   採らなかった案:
--     - period_kind に 'custom' を足す → 親子の段（週の親は月、月の親は年）に
--       入れられず、木のどこにも付かない目標ができる。
--     - period_key に範囲を詰める（'2026-10-28..2026-11-15'）→ 既存の CHECK
--       （goals_payload_period_key_shape）と、鍵で期間を引く読み取り
--       （MCP の list_goals・朝刊の目標）をすべて書き換えることになる。
--
-- SCOPE:
--   1. goals_payload に start_date / end_date（date・NULL 可）を足す。
--      NULL = 期間の種類と鍵が決める今までの期間。
--   2. CHECK を 1 本。2 列は両方あるか両方無く、あるときは終了日が開始日より
--      前にならない。
--   backfill は無い。既存の行は何も変わらない（新しい列はすべて NULL）。
--
-- 1 期間 3 件の上限は DB に元から無い（0034 の「DB で守らないこと」）。#2366 で
--   外すのは画面（GoalTreeView）と MCP（goalHandlers）の側だけで、ここでは何も
--   しない。
--
-- RLS は列単位ではないので、goals_payload の既存の owner-only ポリシー（0034）が
-- そのまま新しい列も覆う。Realtime も goals_payload は 0034 で加入済み。どちらも
-- ここでは重ねて書かない。
--
-- ⚠️ MERGE ORDER: shared の GOALS_PAYLOAD_COLUMNS は列名を明示した select で、
-- 同じ PR で start_date / end_date を読むようになる。この列リストを使うのは、
-- アプリの目標の読み込み（fetchGoals）・作成後と更新後の読み直し
-- （createGoal / updateGoal）のすべて。本番に列が無い状態でコードだけ入ると、
-- 「目標と Todo」と朝刊の目標の読み込みと作成が 42703 で失敗する。
-- **push が merge より先**であること。MCP（goalHandlers）は 2 列を読まないので
-- Worker の deploy の順は問わない。
--
-- 同期（CLAUDE.md §3.3）: payload は updated_at を持たない。範囲を書き換えるときも
--   items_meta.updated_at を上げる（goalUpdatesToPatches が meta の patch を必ず
--   作る — DB-Q2）。

begin;

alter table public.goals_payload
  add column if not exists start_date date,
  add column if not exists end_date   date;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'goals_payload_date_range'
       and conrelid = 'public.goals_payload'::regclass
  ) then
    alter table public.goals_payload
      add constraint goals_payload_date_range check (
        (start_date is null) = (end_date is null)
        and (start_date is null or end_date >= start_date)
      );
  end if;
end
$$;

commit;
