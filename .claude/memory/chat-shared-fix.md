# MEMORY (chat-shared-fix)

## 進行中

（なし）

## 直近の完了

- **#1748 を PR まで（2026-09-20）**: Desktop 初回ツアーで Todo の 3 ステップが飛ばされる件。原因はアンカーが `ScheduleSidebar` にあり、そのサイドバーが `RightSidebarPortal` 経由でしか描かれないこと（`isOpen` は非永続なので毎回閉じて始まる）。ツアー基盤に**前準備 `TourStep.reveal`**（候補 A）を足し、`TourProvider` が新 prop `onRevealStep` でホストに開かせてから probe の締切を測る。開く実体は `web/src/AppProviders.tsx` の新 `TourRevealHost`（`useRightSidebarOptional()?.open`）。**狭幅は意図的に辞退**（`MobileDrawer` の z-50 が吹き出し z-45 を覆うため、開くと「飛ばされる」より悪い「読めないまま止まる」になる）。`web/src/schedule/**` は 1 行も触っていない（#1642 の Scope）。**PR #1757**（open）。verify 全 14 ステップ + docs-lint をローカルで exit 0 ✅（2026-09-20）
- **/goal 4 件を PR まで（2026-09-19）**: #1668 = 投げた undo が「元に戻しました」と出て redo へ進む件（`undo()` / `redo()` が `{ command, ok, error }` を返し、失敗したコマンドは元のスタックへ戻す。Host は danger トースト）→ **PR #1691 はこうだいさんが merge 済み**。#1667 = タグの付け外しを Undo スタックへ + 失敗をトーストに（Scope の 2 ファイルに収めるため履歴はフック内の `useUndoRedoOptional` で拾う）→ **PR #1697**。#1670 = Trash の復元判定を `restoreScheduleItemFromTrash` 1 本にまとめ、楽観更新を撤去 → **PR #1702**。#1672 = `<kbd>` 5 箇所を `font-sans` に統一（方針 A）+ source scan の守り → **PR #1704**。4 本とも verify 全ステップ + docs-lint をローカルで exit 0 ✅（2026-09-19）
- **#1583 を PR まで + #1512 の着地確認（2026-09-12）**: ツアーの「スキップ」が `stopAt(true)` でツアー全体を終了し以後オファーされなくなっていた件。`skip` を `next` と同じ機構（`goTo(index + 1, "walked")`・最終ステップで完了扱い・action ステップでも押せる）に変え、旧挙動は新設の `end`（ラベル「ツアーを終了」/ "End tour"）へ移した。`end` が `skipped: true` を立てる唯一の経路で、フラグの意味と #1194 / #1359 の partial run 封印は不変。「ツアーを終了」は進捗カウンタの隣（左）に置き、#1264 のフッター折り返し設計（右群 240px）を崩していない。**PR #1594**（open）。verify 全ステップ + docs-lint をローカルで回し、**mcp-server test の 1 件だけ赤** — #1589（同日 main）が足した `remoteRegistry.test.ts` が Windows のパス区切り `\` を `/` と比べているだけで、この branch は mcp-server を触っていない（PR 本文に明記）。role-qa（read-only）は PASS・確定 defect 0。**#1512 は実装が全部着地済み**（PR #1556 merged・子 Issue #1557〜#1562 全 CLOSED・残件 #1578 = PR #1585 が 2026-09-12 merged）で残るのは close だけだが、`gh issue close` が auto mode の分類器に止められた ✅（2026-09-12）
- **#1408 の findings 3 件を PR まで（2026-09-05）**: #1468 / #1474 / #1481 をそれぞれ `origin/main` から切った独立ブランチで **PR #1493 / #1498 / #1496**（3 本とも open）。**3 件とも Issue の Scope 行が実際の修正先を外していた** — #1468 は `web/src/` ではなく `shared/src/components/SidebarNav.tsx`（DoD の `cd web && ...` では shared の lint / テストが 1 度も走らない）、#1474 は**報告された 2 つの「保存」が共有 `<Button>` を通っていない**手書き markup（`Button.tsx` だけ直しても報告画面は変わらない）、#1481 は言語の持ち主が `ThemeContext.tsx`（既に documentElement 副作用を 4 本持っている場所）。#1468 は DoD の 3 択のうち **1 つでは全フォント段 × 2 ロケールを保証できない**ため「譲る順番の固定」（ラベルは絶対に縮まない → バッジが省略 → `overflow-hidden` が刈る）にし、バッジが等幅だったのは Tailwind preflight の残りだと突き止めて `font-sans` で降ろした。**守りが効くことは 3 本とも反転実測**（戻すと赤くなることを確認）。**ビルド後の CSS に新ユーティリティが出ていることまで確認**（`font-sans` は 1474 ブランチのビルドに 0 件・1468 ブランチに 1 件）✅（2026-09-05）

## 予定

- **🛑 こうだいさん手番 — #1757（#1748）の merge**（P-001）。実ブラウザでの Desktop 通し確認（4〜6 が本当に出るか）は Issue の Gate どおり merge 後に chat-main
- **狭幅のツアーは #1748 では直していない**: 仕組み（`reveal`）は幅を問わず使えるが、吹き出し z-45 と `MobileDrawer` z-50 の順序が解決するまでホスト側で辞退している。z 順を直す Issue は未起票（起票は chat-main の手番）
- **🛑 こうだいさん手番 — merge 待ち 3 本**（P-001）: **#1697（#1667）/ #1702（#1670）/ #1704（#1672）**。3 本とも `origin/main` から独立に切ってあり触るファイルが重ならない。#1691（#1668）は 2026-09-19 に merged。**#1697 は #1638（schedule レーン）の前提** — あちらの計画書が `useWikiTagsUnifiedAPI.ts` を Scope 外に置いているため、この 1 件だけ向こうでは塞げない。実ブラウザでの目視は chat-main の手番（#1672 のキーキャップ 5 箇所、#1667 の失敗トースト）
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
