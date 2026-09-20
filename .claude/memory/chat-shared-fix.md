# MEMORY (chat-shared-fix)

## 進行中

（なし）

## 直近の完了

- **#1773 を PR まで（2026-09-20）**: ツアーを Escape で中断して再開すると 5/10 ではなく 4/10 に戻る件。#1748 の `reveal` が詳細パネルしか戻さず、Todo トレイの anchor（`schedule-todo-add` / `-todo-board`）が「パネルが開いている」かつ「Todo タブが選ばれている」の **2 つ**を必要とすることを見落としていた。`TOUR_REVEALS.scheduleTodoTray` を新設して step 5 / 6 が名乗り、**step 4 は `detailPanel` のまま**（タブを押すことがその step のレッスンなので代行しない）。Web 側は `requestTodoTray`（`pendingTodoTray` を navigation 抜きで上げる）を新設し `AppProviders` → `MainScreen` で配線。狭幅は引き続き辞退。`TourContext.tsx` は変更不要だった。**PR #1777**（open）。verify 全 15 ステップ + docs-lint をローカルで exit 0 ✅（2026-09-20）
- **#1748 を PR まで（2026-09-20）**: Desktop 初回ツアーで Todo の 3 ステップが飛ばされる件。原因はアンカーが `ScheduleSidebar` にあり、そのサイドバーが `RightSidebarPortal` 経由でしか描かれないこと（`isOpen` は非永続なので毎回閉じて始まる）。ツアー基盤に**前準備 `TourStep.reveal`**（候補 A）を足し、`TourProvider` が新 prop `onRevealStep` でホストに開かせてから probe の締切を測る。開く実体は `web/src/AppProviders.tsx` の新 `TourRevealHost`（`useRightSidebarOptional()?.open`）。**狭幅は意図的に辞退**（`MobileDrawer` の z-50 が吹き出し z-45 を覆うため、開くと「飛ばされる」より悪い「読めないまま止まる」になる）。`web/src/schedule/**` は 1 行も触っていない（#1642 の Scope）。**PR #1757**（open）。verify 全 14 ステップ + docs-lint をローカルで exit 0 ✅（2026-09-20）
- **/goal 4 件を PR まで（2026-09-19）**: #1668 = 投げた undo が「元に戻しました」と出て redo へ進む件（`undo()` / `redo()` が `{ command, ok, error }` を返し、失敗したコマンドは元のスタックへ戻す。Host は danger トースト）→ **PR #1691 はこうだいさんが merge 済み**。#1667 = タグの付け外しを Undo スタックへ + 失敗をトーストに（Scope の 2 ファイルに収めるため履歴はフック内の `useUndoRedoOptional` で拾う）→ **PR #1697**。#1670 = Trash の復元判定を `restoreScheduleItemFromTrash` 1 本にまとめ、楽観更新を撤去 → **PR #1702**。#1672 = `<kbd>` 5 箇所を `font-sans` に統一（方針 A）+ source scan の守り → **PR #1704**。4 本とも verify 全ステップ + docs-lint をローカルで exit 0 ✅（2026-09-19）

## 予定

- **merge 済みを 2026-09-20 に実測**（`gh pr view --json state`）: **#1757（#1748）/ #1697（#1667）/ #1702（#1670）/ #1704（#1672）は全部 MERGED**。残るのは実ブラウザでの目視で、どれも chat-main の手番 — #1748 は Desktop 通しで step 4〜6 が本当に出るか、#1672 はキーキャップ 5 箇所、#1667 は失敗トースト
- **🛑 こうだいさん手番 — #1777（#1773）の merge**（P-001）。実ブラウザでの Escape → 再開の 1 往復は Issue の Gate どおり merge 後に chat-main
- **狭幅のツアーは #1748 では直していない**: 仕組み（`reveal`）は幅を問わず使えるが、吹き出し z-45 と `MobileDrawer` z-50 の順序が解決するまでホスト側で辞退している。z 順を直す Issue は未起票（起票は chat-main の手番）
- **gate を一括で回すと vitest が負荷で落ちる（この機）**: shared の `weekStartsSunday` と web の `briefingEveningLazyMount` が各 1 回タイムアウトしたが、単独では両パッケージとも全件緑。ローカル gate はテストステップを 1 回だけ再実行する形にしてある。バックグラウンドの bash を止めても子プロセスが残るので、gate のログ名は実行ごとに変えること
- **旧 merge 待ちはすべて解消**（2026-09-19 に `gh pr view --json state` で実測）: #1594 / #1597 / #1498 / #1410 / #1376 は全部 MERGED。**#1512 の close だけが残っている** — close コメントは書き上げてあるが `gh issue close` が auto mode の分類器に止められるため、こうだいさんか chat-main の手番
- **mcp-server のテスト 1 件が Windows で赤（この機だけ）**: `tests/remoteRegistry.test.ts` の `would have caught the verification domain` が `utils\verification.ts` を `utils/verification.ts` と比べて落ちる（#1589 由来・2026-09-12 の main）。CI の Linux では通る種類なので実害は「Windows でローカル verify する人の偽の赤」。起票は chat-main の判断（outbox に依頼済み）
- **QA が残した判断 2 件（どちらも見送り・Issue にしていない）**: ① en の "Skip" を "Skip step" にするか（Issue は「スキップ」据え置きを前提にしている）② 最終ステップは Skip と Done が同じ結果になるので Skip を隠すか。どちらもラベル / UX 判断で、#1583 の仕様どおりに実装した
- **判断キューに 1 件追加（`D-20260905-shared-fix-1`・未回答）**: #1474 で残した塗り disabled ボタン 7 箇所も揃えるか。単なる横展開ではない — `danger` の disabled は TrashView / DeleteAccountDialog / AttachmentCleanupPanel で**「処理中」の意味**で使われており、灰色に沈めると「作動中」ではなく「無効になった」と読める（`NotePasswordDialog.tsx:199` はスピナーもラベル差し替えも無く `aria-busy` だけ）。放置時は現状維持で追加作業なし
- **outbox に Issue 起票依頼 1 件**: `<kbd>` は repo 内 5 箇所すべてが Tailwind preflight 由来の等幅（誰も選んでいない）。#1468 でサイドバーの 1 つだけ `font-sans` にしたので、**同じ画面のヘッダー検索欄のキーキャップと書体が割れる**。5 箇所を揃えるかはプロダクト全体のタイポグラフィ判断なので Scope 外にした
- **`git push` がこの機で通らない**: Git Credential Manager が対話を要求する。`git -c credential.helper='!gh auth git-credential' push` で回避できる（`gh auth setup-git` が未実行）
- **判断キューに 2 件積んだ（どちらも未回答）**: **D-20260901-shared-fix-1** = セクション再生を「続きから」再開させるか、栞は持ちつつ常に先頭から始めるか（#1376 は前者で実装済み。放置時は現状のまま）／ **D-20260901-shared-fix-2** = 朝刊「今日のスケジュール」の Todo 行のチェックボックスも 20px に揃えるか。持ち越し行と同じ 16px の手書きボックスが同じ紙面に残っている。揃えると (1) #939 で統合された 1 リストの中で Todo 行だけ背が高くなり、(2) #1369（briefing-refine）が同じ `<li>` を編集中。推奨は #1369 着地後に別 Issue
- **🛑 こうだいさん手番が 2 件たまっている**（どちらも Supabase ダッシュボード）: ① #919 = Authentication → URL Configuration に公開 Web URL を登録 / Reset Password テンプレートの確認 / 実際に 1 通届くかの実測 ② #956 = Sign In / Providers → Email → **Minimum password length を 6 → 12**（手順は PR #967 本文）
- **chat-main の手番（実ブラウザ検証）**: #1192 の DoD 後半 = ツールチップ表示中に `elementFromPoint` がタグの選択肢自身を返すこと。jsdom は「ポップオーバーが開いているあいだ描画されない」までしか保証できない（座標が全部 0 = §7.1）。#1193 も「step 3 で中断 → リロードでツアーが必ず出る」を実機で見るのが最終確認。**#1194 も同種**（全画面モーダルの見た目と、セクションを選んだあと本当にツアーのふきだしが出るか）。ほかに #992 / #947 / #874 / #880 の実機確認が未消化
- **ツアーの進捗は localStorage 据え置きで決着済み**（D-20260827-shared-fix-1 = A・台帳へ昇格済み）。差し替え先は今も `shared/src/hooks/useTourProgress.ts` の 1 ファイルに閉じている（#1359 で `sectionStepId` を 1 つ足したが、閉じ込めは維持）
- **未起票の穴（起票は chat-main の手番 → outbox 依頼が要る）**: `web/src` にエラーバウンダリが 1 つも無く `vite:preloadError` のリスナも無いため、`React.lazy` のペイロードが落ちるとルートごと unmount して真っ白になる
- **`D-20260812-web-1` の supersede 記録は chat-web-public の手番**（#991 = PR #1027 が却下案を復活条件どおりに実装した。単一書込者原則により私は書けない — outbox に依頼済み）
- **#1005 / #1009 は `[web-public]` 接頭辞**なので自分宛としては拾っていない（`shared-fix` ラベルは付いているが宛先 slug が別 = D-20260731-main-2）
- #1079 の残り 2 レバーは着手していない（PR #1129 本文に実測付きで記載）: バレル import の deep path 化は **web 側が config を触らないと 1 行も置換できない**（`exports` にサブパス無し / alias がファイル指し / `paths` にワイルドカード無し）。薄いテストファイルの統合は効果が小さい
- #700（MCP 検証用ツール）— chat-main 側で進行済みの形跡。着手前に重複確認
- #831 の残り: `nav:tasks` / `global:new-task` はショートカット設定が localStorage に id で保存されるため据え置き
