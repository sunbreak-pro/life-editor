# HISTORY ARCHIVE (chat-mobile-refine) — 2026-09

### 2026-08-10 - #589 mobile-scope「現状維持」9 行のコード実測と追随

#### 概要

Epic #321 に唯一残っていた「現状維持で確定する 9 行が本当にスコープ表どおりか」を、コードで全数照合した（PR #651）。**6 行は表どおり、3 行がズレ**。コードは 1 行も変えず、`mobile-scope.md` を実態に追随させ、実装側のズレ 2 件は判断キューと outbox へ回した。

#### 変更点

- **#9 tags が最も壊れていた**: 引用先 `web/src/wikitag/WikiTagsManagementView.tsx` は**表を書いた 2 日後**の #329（`ca2d6192`）で削除済みで、materials の tags タブごと退役（`useShellNavigation.ts:23` = notes | daily）。タグマスタは #409 で全画面共通モーダル（`web/src/tags/TagEditorHost.tsx`）になり、導線は wide サイドバーのみ（`AppShell.tsx:173,187` → `SidebarNav.tsx:184`）。表が「wide 限定」と書いていたグループ管理は**限定ではなく機能ごと退役**（`useWikiTagsUnifiedAPI` に group 系 API が 0 件・`WikiTagGroup` は型だけ残骸）。さらに **#551 / #566 で色編集がスコープ超過** — `CalendarTab.tsx:1540` の `TagColorControls` が narrow では `:2262` の BottomSheet に載り `setTagColor` でマスタを書き換える
- **#1 / #4 は「目標語のほう」がズレ**: どちらも目標列が Consumption（§1 = 閲覧・確認のみ / 編集不可）だが、briefing は完了トグル（`BriefingView.tsx:330,384,461`）と夕刊の気分★（`EveningView.tsx:195`）が、schedule は行タップの `EventEditorPane` シート（`CalendarTab.tsx:2262` ← `:1498`）・FAB の新規作成・完了トグルが narrow で効く。**`git show <doc-commit>:<file>` と `git log -S` で当時のファイルを開いて確認したところ、表を書いた 2026-07-23 時点で既に同じ配線**（#168 / #249 / #266 / #274 由来）。「30+ PR のどれかが壊した」ではなく最初から目標語が実態より狭い、が正しい読み
- **9 行以外の stale も同 PR で**: §3 の `AppShell.tsx:115` → `:147`/`:153`・`sections.ts:68-131` → `:69-132`・`:147` → `:148`、「tasks は materials 配下」→ #411 で Schedule の 2 つ目のタブへ、#11 行の `WorkScreen.tsx:41,362` → `:42`/`:368`、§5 の「追加実装なし」リストを実際に該当する 6 行へ縮小、§6 に「native 省略ガードは Capacitor 殻でしか発火しない（#600 で主導線と確定した公開 Web URL では幅分岐が効いている）」の注記
- **ヘッダの「実測日 2026-07-23（全 file:line 確認済み）」は #9 の引用が 2 日後に消えた時点で破綻**していたので、初回実測日 + 2026-08-10 再実測のスタンプに置換した

#### 手順・知見

- **9 行を 9 エージェントで並列実測 → drift 主張だけアドバーサリアル検証**の構成にした（20 エージェント / エラー 0）。**一次報告の DRIFT 主張は 3 件が検証で棄却**された — いずれも「実測日より前から同じ配線」で、drift（実測後に変わった）ではなく最初からのズレだったもの。**「今のコードと文書が食い違う」と「文書を書いた後にコードが変わった」を混同すると、無実の PR を犯人にする**
- 監査報告の file:line は採用前にメイン側で 15 点以上を実際に開いて照合した（`rules/docs-consistency.md` §5）。**捏造はゼロ**で、ズレていたのは 3 件のアンカー位置だけだった
- 判断キューを増やすと `docs-lint` が索引 stale で落ちる。`node .claude/scripts/records.mjs index` を**同一コミット**で回す（`rules/records.md` §4）
- **キューのファイルを丸ごと Write で書き直すと、既存の注記を静かに落とす**。実際に「回答済み 3 件は台帳へ昇格済み」の 1 行を落として後から戻した（`6128d86c`）。append 先のファイルは Edit で足す
