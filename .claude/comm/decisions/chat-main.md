# Decisions — chat-main

形式は [`README.md`](./README.md) 参照。回答は `ANSWERS.md` へ。

## D-20260806-main-3: コンテキスト削減 Phase 3（移送）の「移行完了」ゲートを前倒しで開けるか

- 背景: 計画書は Phase 3 を「移行（Electron + Capacitor + Web + Supabase）完了後」と定め、Risks に「移行中に移送すると移送先自体が動く」と書いている。一方 Phase 2 の照合で、**新規に作らないといけない移送先は 1 つも無い**ことが分かった（[`docs/vision/claude-md-layering.md`](../../docs/vision/claude-md-layering.md) §2）。移送先が全部実在するなら「移送先が動く」リスクは当初の想定より小さい
- A: **ゲートを維持する**（推奨 — 移行 SSOT と CLAUDE.md §2〜§5 は移行完了時にどのみち書き換わる。今移して移行でもう一度触るのは二度手間。Phase 4 の維持機構は移行と無関係に回せるので、待っても止まらない）
- B: 移行に依存しない項目だけ先に開ける（§7 の手順・§0 の数値の非複製原則・§9 の docs 運用は移行で内容が変わらない。1 PR = 1 項目で 3〜4 件を先行）
- C: 全面的に開ける（移行完了を待たず振り分け表の全行を進める）
- 放置時: A。Phase 3 は移行完了まで着手せず、`/loop-prune` の棚卸しは「検出と記録まで」で回る（loop-prune の停止条件に明記済み）
- 期限感: いつでも（移行完了が近づけば自然に解消する）

## D-20260806-main-2: グローバル資産（`~/.claude/`）をコンテキスト削減の Scope に入れるか

- 背景: 固定費を実測したところ **19,277 tok のうち約 66%（12,711 tok）が `~/.claude/`**（実体 = 別リポジトリ `claude-dotfiles`）にあり、親計画の Scope（`.claude/**` と `.mcp.json`）に入っていない（[計測結果](../../docs/reports/2026-08-06-context-fixed-cost-baseline.md) §2 / §5-1）。とくに口調定義が output style（1,338）+ `rules/tone.md`（2,184）+ `~/.claude/CLAUDE.md` の口調章（950）の **3 か所で重複し、単一項目としては最大の 4,472 tok = 全体の 23%**。三重化は事故ではなく、各ファイルが「正本 / 保険 / 詳細版」と役割を自己申告した意図的な設計
- A: **Scope に入れ、別 PR（`claude-dotfiles` 側）で進める**（推奨 — 支配項に手が届く唯一の道。プロジェクト側だけ削っても効く上限は 3 分の 1。ただし口調は応答品質に直結するので、削るのは「保険」の 1 層だけに絞る）
- B: 入れない（life-editor の Scope はこのリポジトリに閉じる。グローバル側は別タスクとして起票し直す）
- C: 計測だけ続け、削減は当面しない（三重化は意図的なので、費用を承知の上で維持する）
- 放置時: B 相当。振り分け表と `/loop-prune` はプロジェクト側だけを対象に回る（loop-prune の停止条件に「グローバルに手が伸びたら停止」を明記済み）
- 期限感: Phase 3 の着手前まで（Phase 1 / 2 / 4 は本判断に依存せず進む）

## D-20260804-main-1: Phase 1 定期実行（朝 digest / 夜間安全レーン）の実行基盤をどれにするか

- 背景: 親計画 Phase 1（`2026-07-28-loop-engineering-harness.md` §6）のインフラは配置済み（PR = `docs/loop-harness-phase1`）だが、発火の足場が未裁定。実測で、セッション内 scheduled tasks（CronCreate）は**セッション限定 + 繰り返し 7 日期限**と判明し、常駐セッションなしでは毎朝発火に使えない
- A: **Windows Task Scheduler + `claude -p`（headless）**（推奨 — セッション常駐が不要・2026-07-16 の朝刊プロトタイプで同型を E2E 検証済み・digest の正本がローカルファイルである点とも整合。前提 = 06:03 / 22:33 に PC が起動していること。登録コマンドは `automation/routine-ids.md` に準備済み・初回は手動実行で動作確認）
- B: chat-main セッションを常駐させて CronCreate を使う（7 日ごとの再登録 + 台帳管理が必要。セッションを閉じると消える）
- C: クラウド実行（/schedule 系 — マシン電源に依存しないが、親計画 Non-goals「Cloud Routine の復活はしない」と衝突し、ローカルの digest / outbox ファイルに書けない。採る場合は親計画の改訂が先）
- 放置時: 自動発火なし（現状維持）。digest / 夜間安全レーンは手動起動（`run-routine.ps1` または dev-digest スキル）でのみ動く
- 期限感: いつでも（Phase 1 の効果量はここで決まるが、手動運用でも回る）

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
