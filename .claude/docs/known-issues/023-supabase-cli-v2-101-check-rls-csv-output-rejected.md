# 023: Supabase CLI v2.101 で `check-rls` 系 sql 出力が CSV 化され流し直しが拒否される

**Status**: Fixed (運用ルール化)
**Category**: Tooling
**Severity**: Minor

**Discovered**: 2026-05-23

## Symptom

DU-B-1 で `supabase db dump --schema public` や `supabase db lint --output sql` を v2.101 で実行すると、ヘッダ行・区切り文字・引用形式が CSV 寄りに変化し、得られた出力を別ターミナルで `psql` に流し直そうとすると syntax error で止まる。v2.x 系の以前のバージョンでは plain SQL で出ていた。

## Root Cause

Supabase CLI v2.101 のリリースで出力フォーマットの default が変わり、SQL リテラル出力ではなく CSV 形式（カラム名ヘッダ + クォート付き値）になった。`check-rls.sh` のように「Supabase 側で SELECT した結果をそのまま `psql` に流す」フローが破綻する。

## Impact

- CI / 検証スクリプトで「SQL Editor 出力 → psql 流し込み」型のパイプラインが壊れる
- DU-B-1 の RLS 検証手順がワンライナーで回らなくなり、手作業 SQL に置き換える必要が生じた

## Fix / Workaround

- 検証 SQL は **`.claude/docs/vision/plans/` 配下に直接 `.sql` ファイルとして保存**し、Supabase Dashboard SQL Editor で手動 Run する運用に切り替え
- Sentinel パターン（`select '___RLS_GATE_OK___' as gate`）でアウトプットの存在 / 件数だけ目視確認
- CLI 自動化を続けるなら v2.100 にピン留め、または `--output json` で受けて jq 整形

## References

- 関連 plan: `.claude/docs/vision/plans/2026-05-23-data-unification-a-db-schema.md`（archive）
- 関連: [known-issue 022](./022-supabase-sql-editor-postgres-role-auth-uid-null.md)（同じく RLS 検証運用の落とし穴）

## Lessons Learned

- Supabase CLI は minor バージョン跨ぎで出力フォーマットの default が変わることがある。検証スクリプトはバージョンピン or 明示 `--output` 指定が必要
- 「Editor で手動 Run」フォールバック手順を SSOT に置いておくと CLI 不調時に詰まらない
- 検索キーワード: `supabase cli 2.101`, `check-rls csv`, `db dump output format`, `psql syntax error from supabase output`
