# Decision Queue — chat-tags-docs

worktree `tags-docs`（担当 = #368 / #474 / #472 / #473）。

### D-20260730-tags-1: ClaudeDesign fan-out 計画書を archive に移すか（CLAUDE.md §6 の「追跡正本」宣言の付け替え）

- 背景: #474 の実測で `docs/vision/plans/2026-07-04-claudedesign-screen-design-fanout.md` は COMPLETED 相当（brief 9 本 + 実装 PR #160 / #164〜#168 / #170 / #174 / #175 が全 merge・Step 8 以降は別計画が承継）。ただし `.claude/CLAUDE.md:54` と `.claude/docs/design/README.md:21` が本書を「**Web/Mobile UI デザインの追跡正本**」と宣言しており、archive に移すと「正本が完了済み書庫にある」矛盾が出る。承継先の 07-05 / 07-10 も #474 で archive 化済みで、デザイン追跡の実務は Epic #321 + `docs/requirements/mobile-scope.md` + Issue 群へ移っている
- A: COMPLETED 化して archive へ移し、CLAUDE.md §6 の宣言を「デザイン追跡は Epic #321 + mobile-scope.md（完了した fan-out は archive/）」へ書き換える（推奨 — 実態に一致する。ただし CLAUDE.md の SSOT 行を worktree が書き換えることになる）
- B: plans/ に残し、Status 行に「追跡正本として維持中」の根拠を明記する（CLAUDE.md は無変更）
- 放置時: plans/ に IN PROGRESS のまま据え置き。#474 の他 11 本の判定・移動は完了済みなので後続作業はブロックしない
- 期限感: いつでも（#474 の PR merge をブロックしない）

### D-20260731-tags-2: #499 の DoD 1「全件 GET を含まない形に減っている」をどこまで満たすか

- 背景: #499 の原因は `shared/src/context/SyncContext.tsx:130-136` が 19 テーブルすべての Realtime 変更を 1 本の `syncVersion` に畳んでいることで、1 テーブル書くと購読中の全ドメインが自分のコレクションを全件取り直す。テーブル単位に bump を分ければ 1 周 15 本が大幅に減るが、**「全件 GET をゼロにする」には読み取りを `updated_at` cursor の差分取得へ変える必要がある**。ところが物理削除（`permanentDelete`）にトンボ（消えた印）が無いため、cursor だけでは「消えた行」を検知できず、差分化は削除検知の設計から要る = #499 のスコープを大きく超える
- A: 今回はテーブル単位 bump + timer の ensure 分離までとし、削減量を実測して PR に記載する（推奨 — 波及が機械的で同期整合を壊さない。全件 GET は残るが「1 打鍵ごとに 15 本」は解消する）。残る差分取得は follow-up Issue に切る
- B: DoD の字面どおり全件 GET をゼロにするまでやる（cursor 差分取得 + トンボ設計。DDL 変更が要る可能性が高く、`git-workflow` の 🛑 人手ゲートに触れる）
- 放置時: A で実装し、PR 本文に「全件 GET の完全排除は削除検知の設計が要るため別 Issue」と明記する
- 期限感: #499 の PR を出す前（放置なら A で出す）

### D-20260731-tags-3: MaterialsCountsBridge の全件取得を件数クエリに置き換えるか（#499 の追加スコープ）

- 背景: `web/src/MaterialsCountsBridge.tsx:33-50` はサイドバーのバッジ用に task / note / daily の**ノードを全件取得**して数えている（1 周 15 本のうち 6 本がこれ）。テーブル単位 bump を入れても items_meta と notes_payload は動くので、ノート編集ではこの 6 本が残る
- A: 今回のスコープに含め、`count: 'exact'` 相当の件数取得メソッドを DataService に足す（削減幅は大きいが、DataService インターフェース拡張 + バッジの意味論確認が要る。「未完了タスク数」のような条件付き集計は単純 count で出せない可能性があり、`computeMaterialsCounts` の中身次第）
- B: 今回は触らず follow-up Issue に切る（推奨 — #499 の本体である「1 書き込み → 全ドメイン再取得」の解消と、バッジ集計の作り替えは別の話。1 PR に混ぜると監査面が広がる）
- 放置時: **実装者がコードを読んで判定する**。`computeMaterialsCounts` が単純な件数で表現できるなら A、条件付き集計を含むなら B にして follow-up を outbox へ回す
- 期限感: #499 の PR を出す前
