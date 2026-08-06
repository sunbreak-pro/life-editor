---
name: loop-verify
description: 検証ゲートを通し、落ちた原因をコード起因か環境起因かに切り分けるループ。PR 前や merge 後の main が緑か確かめたい時にユーザーが明示起動する。
disable-model-invocation: true
---

# /loop-verify — ゲートを通し、落ちた原因を切り分ける

## 目標

対象の変更（作業ブランチ、または merge 後の main）に検証ゲートを通し、緑にする。緑にできないものは**コード起因か環境起因かを言い切って**手を離す。

## 完了条件（機械検証可能）

- CLAUDE.md §7.1 のコマンド（`dev` を除く）がすべて exit 0、**または**落ちた各件に「コード起因 / 環境起因」の結論と根拠 1 行がついている
- 環境起因と結論したものが `.claude/docs/known-issues/INDEX.md` の既知パターンに載っているか、載っていなければ候補として書き出されている
- コード起因で未修正のものが 1 件も残っていない（残るなら停止条件に当たっている）

## 予算

- 反復上限: **3 周**（1 周 = ゲート一巡 → 修正）。`session-verifier` が各ゲート内で最大 2 回リトライを持つので、本ループはその**外側の輪**。二重に数えない
- 時間上限: **30 分**。開始直後に `START_TS=$(date +%s)` を取る
- 超えたら、緑にできた範囲と落ちたままの一覧を出して停止する

## 停止条件（人間に返す）

- **環境起因と判断できた時点**（そこから先はこのループの担当ではない。深追いしない）
- 落ちているのが自分の変更していないファイルで、直すと Scope の外に出る
- 同じゲートが 3 周とも同じ理由で落ちる（周回を増やしても状況が変わっていない = 前提が違う）
- 修正すると別のゲートが落ちる往復に入った（2 往復で停止）

## 使ってよい道具

- `session-verifier` スキル — ゲートの正本（Gate 0 Scope → 1 型 → 2 lint → 3 test → 4 coverage → 5 プロジェクト規約）
- `debug-strategy` スキル — 原因の切り分けが噛み合わないとき
- `.claude/docs/known-issues/INDEX.md` — 既知の環境起因パターンの照合先

## 環境の事実（推論では埋まらないので明記する）

- ゲートは `shared` / `web` / `desktop` で**別々に回す**。`web` の lint は `web/` 配下しか歩かないので、`shared/` に入れた lint error は `cd shared && npm run lint` でしか出ない（PR #488 で CI だけが落ちた実例）
- **TypeScript の版が `web` だけ違う**（web = 6.x / shared・desktop = 5.6）。`cd web && npm run build` は shared を web 側の tsc で検査するので、片方だけ緑でも安心しない
- `scripts/docs-lint.sh` はローカルで回すとき `LC_ALL=C` を付ける（Git Bash の grep 3.0 + UTF-8 locale では日本語を含む Status 行が偽陽性になる）
- **`web/tests/` の jsdom にレイアウトが無い**（要素の座標がすべて 0）。画面座標に依存する経路はここでは検証できない — 落ちていなくても「通った」と読まない
- 実ブラウザ検証（playwright MCP）と dev server は **chat-main のみ**。worktree 側は build / 型検証まで
- ゲート一覧の正本は `.github/workflows/ci.yml`（`docs-lint` は CI 専用ジョブ）

---

- 「たぶん環境」で止めない。環境起因と言い切るなら根拠を 1 行つける（既知パターンとの一致 / 別マシンとの差 / 再現条件）
- 実測した周回数・所要時間は、区切りで `2026-08-04-loop-catalog-implementation.md` の Worklog に 1 行足す
