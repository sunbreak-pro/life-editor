# Decisions — chat-main

形式は [`README.md`](./README.md) 参照。回答は `ANSWERS.md` へ。

## D-20260801-main-2: `archive/` の Status 表記に plans/ の enum を適用するか

- 背景: #474 で `.claude/archive/*.md` 83 本を全数実測した結果（chat-tags-docs 申し送り）、DoD の検証条件 `grep -n "^Status:"` には掛からない不整合が 2 種残っている。**enum は元々 plans/ 用**（CLAUDE.md §9）で、archive には計画書以外（要件定義書・棚卸しメモ）も同居しているため、機械的に当てると文書種別の情報が落ちる
  - `**Status**:` 形式で enum 外が 2 本 — `01_要件定義書_プロトタイプ環境.md:3` = `SPECIFICATION（凍結）` / `code-inventory-2026-04-25.md:3` = `ARCHIVED`（どちらも blockquote 内）
  - Status 行が無いのが 4 本 — `2026-05-11-apply-release-docs.md` / `db-conventions-tauri-era.md` / `desktop-followup-2026-04.md` / `SUMMARY.md`（最後は索引なので無くて妥当）
- A: **enum は plans/ 由来の文書だけに適用する**と明記し、archive の非計画書 2 本はそのまま残す（Status 行の無い 3 本にも足さない）。推奨 — enum は「計画がどこまで進んだか」の語彙で、要件定義書に `COMPLETED` を当てても意味が通らない
- B: archive 全体に適用し、2 本を enum 化 + 3 本に Status を追加する（grep 一発で全 archive の状態が読めるようになるが、文書種別の情報は落ちる）
- 放置時: A 相当（現状維持）。ただし「enum は plans/ だけ」がどこにも書かれていないので、次に棚卸しする人が同じ判断を繰り返す
- 期限感: いつでも（#474 は merge 済みで、これは残件の扱い）
- 申し送り（判断とは独立・docs-lint 改善候補）: 全数チェックには `^Status:` だけでは足りず、`^>?\s*Status:` と `^>?\s*-?\s*\*\*Status[^*]*\*\*:` の両方を各ファイル先頭 14 行に当てる必要がある（#474 では grep 単独で 2 本を見落とし、node スクリプトで拾い直した）

## D-20260801-main-1: 1 レーンが多ブランチを並行させたときの tracker ファイル衝突をどうするか

- 背景: 2026-08-01、schedule-refine が 5 本のブランチを並行で持った状態で #506 が merge された瞬間、**残り 4 本すべてが `.claude/history/chat-schedule-refine.md` で衝突**した（#516 は `memory/` も）。`git merge-tree` で実測したところ**コードは全部 auto-merge 可能**で、衝突は tracker ファイルだけ。1 本 merge するたびに次が再衝突するので、4 本ぶんの手作業が要る
- A: tracker の更新を**作業ブランチに載せない**（実装 PR では触らず、merge 後に 1 commit でまとめる）。衝突は構造的に消えるが、PR 単位で「何をしたか」の記録が同時に残らなくなる
- B: tracker を**追記のみ・1 行 1 エントリ**に制限する（git の 3-way は同じ行に触らなければ通る。今は複数行ブロックを同じ位置に足すので必ず当たる）
- C: 現状維持（衝突するたびに手で解消）
- 放置時: C。ただしレーンが 3 本以上のブランチを並行させるたびに再発する
- 期限感: いつでも（次に 1 レーンが 3 本以上を並行させる前まで）

## D-20260731-main-2: `[all]` shared-fix Issue の二重着手をどう防ぐか

- 背景: 2026-07-31 に同じ Issue を 2 レーンが同時に掴む事象が 2 回。#473 = mobile-refine(PR #498 merge) と tags-docs(実装を破棄・ローカル `eaf9ee36` に退避) / #499 = mobile-refine(PR #501 merge) と tags-docs(`3564a89b` で parking)。**どちらも片方の実装が丸ごと無駄になっている**（当初「実害なし」と書いたのは chat-main の観測不足）
- 実証で潰れた案（2026-07-31 追記）:
  - **着手宣言コメントは効かない**。tags-docs は #499 に 00:47 JST で宣言したが、8 時間 23 分後に別レーンが PR #501 を出した。`gh issue list` の出力にコメントは出ないので、一覧しか見ないレーンには届かない（tags-docs 自身が「この案は棄却してください」と実証データ付きで撤回）
  - **assignee も効かない**。この repo の作業者は GitHub 上では全員 `sunbreak-pro` 一人なので、assign しても「どのレーンが持っているか」を表せない
- A: **chat-main が起票時点で宛先 slug を 1 つに決める**（`[all]` を使うのは Epic と全レーン共通の告知だけにする）。tags-docs 推奨・CLAUDE.md §9「宛先 = タイトル prefix」の枠内で、一覧の時点で必ず見える
- B: 現状維持（`[all]` を残し、早い者勝ち + 気付いた側が parking）
- chat-main が先行実施した分（可逆）: 着手・引き受けが確定していた **#503 / #505 の prefix を `[schedule-refine]` に変更**（各 Issue にコメントで理由と差し戻し方を記載）。表明のない #508 / #512 は `[all]` のまま
- 放置時: 先行実施した 2 件はそのまま、新規起票は従来どおり `[all]` を使う（= B 相当に戻る）
- 期限感: 次に `[all]` の Issue を起票する前まで

## D-20260731-main-1: schedule レーンが空回りのままなら #467 / #468 を chat-main が引き取ってよいか（取り下げ）

> 2026-07-31 取り下げ。schedule-refine が `claude/schedule-468-ledger-filter` で #468 に着手したため、前提（レーンが空回り）が消えた。放置時の挙動どおり A（レーンを待つ）で確定。再び数サイクル止まったら起票し直す。

- 背景: #467 / #468 は `section:schedule`（schedule-refine 担当）。2026-07-31 時点で schedule-refine worktree は merge 済みの `claude/schedule-469-gate-docs` に居座り、#467/#468 のブランチは local / origin どちらにも無い（着手ゼロ）。#473 は tags-docs が local ブランチで着手済み
- A: schedule レーンの手番を待つ（推奨 — 1 worktree = 1 チャットの担当分離を崩さない。ラベル routing の前提が守られる）
- B: chat-main が一時 worktree を切って #467 → #468 を実装する（レーン競合のリスクあり。schedule-refine が同じ Issue に着手すると二重実装になる）
- 放置時: A。chat-main は merge gate に徹し、#467/#468 は着手せず監視のみ
- 期限感: いつでも（急がないが、schedule レーンが数サイクル止まったままなら判断が要る）
