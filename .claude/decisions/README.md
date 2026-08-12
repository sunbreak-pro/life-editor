# Decisions — 確定判断の台帳（Decision Ledger）

> **`comm/decisions/` = 未決キュー（揮発）、ここ = 確定台帳（恒久・追記型）。**
> キューのエントリは回答後に消えるが、その「問い・選択肢・採否理由・却下案」をここへ昇格して恒久保存する。
> 採用の経緯と設計 = [`D-20260809-main-1`](./D-20260809-main-1.md)（旧「ADR は作らない」方針を SUPERSEDE）。

## 使い方

- **1 決定 1 ファイル**・ファイル名 = ID（`D-YYYYMMDD-<chat>-<n>.md`、キューの ID をそのまま使う）。新規作成しか起きないため merge 衝突が構造的に発生しない
- **書くのは起票チャットのみ・昇格時 1 回**（単一書込者原則）。作成後は原則書き換えない — 例外は `superseded-by` / `implemented-by` / `promoted-to` への**追記**のみ
- **陳腐化は上書きでなく追加で表現する**: 裁定が変わったら新しい D ファイルを作り、`supersedes` / `superseded-by` で双方向リンクする。[`INDEX.md`](./INDEX.md) は連鎖の末端（現在有効な裁定）だけを Active 表に出す
- `status` enum: `answered`（ユーザー回答済み）/ `recorded`（事後記録 — ユーザー回答を経ない自裁・決着の後追い）/ `superseded` / `withdrawn`。**open はここに置かない**（未決の正本はキュー）
- P-005 に該当する判断（ユーザー体験が変わる分岐）は必ずキュー経由。`recorded` で直接書いてよいのは計画横断の技術判断だけ

## 昇格の手順（キューで回答が付いたら）

1. `decisions/D-<id>.md` を作成 — キューのエントリ本文を「背景」へそのまま貼り、frontmatter を付ける（形式 = [`_TEMPLATE.md`](./_TEMPLATE.md)）
2. キューの自分のファイルからエントリを削除（従来プロトコルどおり。`ANSWERS.md` の行は消さない — frontmatter `answer` との突合で監査可能）
3. INDEX の再生成は不要（git 非追跡の派生ビューで、SessionStart hook が作り直す）。手元で今すぐ見たいときだけ `node .claude/scripts/records.mjs index` を回す

## INDEX.md について

[`INDEX.md`](./INDEX.md) は **`records.mjs` の生成物（git 非追跡・手編集禁止）**。2026-08-12 に追跡を外した（[#735](https://github.com/sunbreak-pro/life-editor/issues/735)）— D ファイルを 1 本足すたびに目次が全文書き換わり、並行レーンの PR が構造的に必ず衝突していたため。追跡外になったので **commit にも PR にも載せない**（再生成は SessionStart hook が自動で行う。手元で古ければ `node .claude/scripts/records.mjs index`）。正本は D ファイル群なので、消えてもいつでも作り直せる。

## 他の記録層との分担

記録型ごとの正本と書き込み先の 1 分判定 → **[`rules/records.md`](../rules/records.md) §1 / §2**（ここが持つのは「問い・選択肢・採否理由・却下案・supersede 連鎖」で、手順・実装詳細は持たない）。
