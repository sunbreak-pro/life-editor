---
id: D-20260823-shared-fix-2
type: decision
status: answered
asked: 2026-08-23
answered: 2026-08-23
chat: shared-fix
answer: A
topics: [docs, known-issues, records]
refs: ["#1087", "#1086", "#1083"]
supersedes: []
superseded-by: []
implemented-by: ["#1087"]
promoted-to: null
---

# D-20260823-shared-fix-2: 参照 0 の known-issue 5 本をどうするか

## 背景

（#1087 の「決めてもらう必要があるもの」②。**削除は不可逆なので P-007 に従い同期確認**した — キューには積んでいない）

#1086 の計測で targeted 参照が 0 回だったのは **5 本**（Issue 本文は 7 本と書いていたが、実測は 007 / 010 / 023 / 030 / 032。004 / 006 / 033 は 1〜2 回で非ゼロ、032 は起票後に発生した知見）。5 本は `known-issues/INDEX.md` の表以外どこからも参照されていない。

内訳を読むと 1 つの束ではなかった:

- **前提ごと消えた 2 本**: 007（`cargo tauri ios dev` の XcodeGen 再生成）/ 010（Tauri + Cloudflare D1 期の delta sync 脱落）。現行スタック（Electron + Supabase・`items_meta.updated_at` LWW）に対応するコードが無い
- **今日も再現する 2 本**: 030（formatter が frontmatter の配列を折り返し `records.mjs` の行単位パーサが落ちる — 修正コードは `scripts/records.mjs` に現存）/ 032（コミット本文の行頭 `#` が `core.commentChar` に食われる — この repo の `core.commentChar` は未設定＝既定 `#`）
- **検証不能 1 本**: 023（Supabase CLI v2.101 の出力形式。この機に CLI 未インストール。かつ PR #1083 で「参照 0 のまま初めて引かれ、そして誤誘導した」当人）

## 選択肢と裁定

- **A: 束を割って個別に処理**（**採用** — ユーザー回答 2026-08-23）。007 / 010 = **削除**（git 履歴に残るので復元は可能）/ 030 / 032 = **入口を張る**（030 → `rules/records.md` §4 / 032 → CLAUDE.md §7.2）/ 023 = **凍結**（本文に明記し、入口は張らない）
- B: 全部残して入口だけ張る（却下 — 前提が消えた 2 本に入口を張ると、次に引いた人を 023 と同じ形で誤誘導する。死蔵より誤誘導のほうが高くつく、というのが #1083 の教訓）
- C: 5 本とも削除（却下 — 030 / 032 は今日も再現する。参照 0 は「価値が無い」ではなく「入口が無い」を意味しうる、というのが [`D-20260823-shared-fix-1`](./D-20260823-shared-fix-1.md) の前提）

## 却下案が復活する条件

- 入口を張った 030 / 032 が次の計測でも参照 0 のままなら、入口の位置が悪いか知見自体が不要 → 位置を変えるか C（削除）へ

## 波及

- 以後の採否条件は [`D-20260823-shared-fix-1`](./D-20260823-shared-fix-1.md)（`rules/records.md` §2 が正本）
- 棚卸しの再実行 = `node .claude/scripts/known-issue-usage.mjs`（#1086）
