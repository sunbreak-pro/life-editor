# ANSWERS — 判断キューへの回答簿

書込者はこうだいさん（または転記を任された chat-main / digest セッション）のみ。形式は `decisions/README.md` 参照（1 行/件・回答済み行は消さない — 監査ログを兼ねる）。

<!-- 例: - D-20260728-sched-1: A（理由があれば一言） -->

- D-20260728-main-2: A（noteDropIntent.ts は残置。2026-07-28 チャットで回答・chat-main が転記）
- D-20260728-main-3: A（#368 は「名前の絞り込みのみ」に縮小して続行。2026-07-28 チャットで回答・chat-main が転記）
- D-20260731-tags-2: A 相当で決着済み（ユーザー回答ではなく**事後記録**。#499 は mobile-refine の PR #501 として merge され、テーブル単位 bump までで着地。全件 GET の完全排除は別 Issue = #511 へ。2026-07-31 chat-main 記録）
- D-20260731-tags-3: B で決着済み（同じく**事後記録**。MaterialsCountsBridge の件数クエリ化は #499 に含めず follow-up の **#511** に切った。2026-07-31 chat-main 記録）
- D-20260801-sched-1: A（移動時にレンズを外す。生成 4 経路の `finishCreatePanel()` と同じ扱いにする → **#520 の 🛑 ゲート解除・実装可**。2026-08-01 チャットで回答・chat-main が転記）
- D-20260731-main-2: A（chat-main が起票時点で宛先 slug を 1 つに決める。`[all]` は Epic と全レーン共通の告知だけに使う。同上）
- D-20260801-main-1: A（tracker の更新を作業ブランチに載せない — 実装 PR では触らず merge 後に 1 commit でまとめる。同上）
- D-20260801-main-2: A（enum は plans/ 由来の文書だけに適用する。archive の非計画書 2 本と Status 行の無い 3 本はそのまま。同上）
- D-20260730-tags-1: A（ClaudeDesign fan-out 計画書を COMPLETED 化して archive へ移し、CLAUDE.md §6 の「追跡正本」宣言を Epic #321 + mobile-scope.md へ付け替える。同上）
- D-20260730-mobile-1: A（3 択のタッチ行を維持。**ユーザーの明示回答ではなく「放置時 A」での確定** — 2026-08-01 の回答は mobile-2 / mobile-3 のみを指名。chat-main 記録）
- D-20260730-mobile-2: **B**（`BottomSheet` に明示的な「閉じる」ボタンを追加する。2026-08-01 チャットで回答・chat-main が転記）
- D-20260730-mobile-3: **B**（Desktop と同じ「本文だけロック」に揃える = モバイルのパスワード付きノートも、解錠なしでタイトル / タグ / ピン / 削除を触れるようにする。同上）
- D-20260806-main-1: **B**（P-001 は文言どおり据え置き。merge は常にこうだいさん。**条件つき自動 merge は開けない**ので、到達点は「第 1 段 = `claude/*` への push + draft PR 作成の解放」と「第 3 段 = merge 後 main 検証 → 赤なら自動 revert」の 2 段までとする。2026-08-06 チャットで回答・chat-main が転記）
- D-20260804-main-2: **A + C**（D-20260806-main-1 = B の定義に含まれるため同時決着。`permissions.ask` に `Bash(gh pr merge*)` を追加して P-001 を機械で担保し、あわせて `git-workflow` §0.1.1 の自動マージは life-editor 非適用と CLAUDE.md に明記する。同上）
- D-20260806-main-2: **A**（グローバル資産を Scope に入れ、`claude-dotfiles` 側の別 PR で進める。削るのは「保険」の 1 層に絞る。2026-08-06 チャットで回答・chat-main が転記）
- D-20260809-main-1: **A**（決定台帳 `decisions/` を新設し「ADR は作らない」方針を SUPERSEDE する。2026-08-09 remote セッションの AskUserQuestion で回答・同セッションが転記）
- D-20260806-main-3: **A**（Phase 3 の移行ゲートは維持する。life-editor 側の移送は移行完了後。**グローバル側は本裁定に縛られない** — ゲートの根拠は「移送先自体が動く」ことで、移行で動くのは life-editor の CLAUDE.md §2〜§5 と移行 SSOT であって `~/.claude/` ではない。同上）
