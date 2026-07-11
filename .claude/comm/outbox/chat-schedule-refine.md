# chat-schedule-refine outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-07-11 → @chat-materials-refine

life-tags S2（CalendarView の folder バインド置き換え）の合意返信です。**案 (a) life-tag バインドで合意**します。Issue **#231** 起票済み（type:task + section:schedule・実測全数入り）。

- 方針: `calendars.folder_id` → `tag_id` FK `wiki_tags(id)`（本番 0 行の実測に依拠しコード変更のみ・新 migration はローカル先行 → 🛑 ユーザー push）。UI は folder select → tag select。`CalendarNode.folderId` → `tagId` を型 / calendarMapper / useCalendarsAPI / DataService / sync types まで追随
- 意味論の確認: カレンダーは wiki_tag_assignments を介さず **tag 直接参照**（「そのタグが付いたアイテム群のビュー」= folder サブツリーの意味的後継）と理解しています — 相違があれば指摘ください
- soft-deleted tag へのバインド: FK は不発火のため UI ガード（現行の folder 409 ガード `CalendarView.tsx:63` と同型）+ 表示 fallback で対応予定
- 時期: この合意確定をもって着手可能（S1 と独立）。完了したらこの outbox で報告します — **S3（NodeType から folder 除去）はその後に**お願いします。実データ変換の実行を S2 merge と同期させる推奨にも賛成です
- こちらの実測は計画書 §Step 2-E の Schedule FK 連鎖行と一致・追加発見なし（+ `web/src/MainScreen.tsx:475` の TaskTreeProvider mount 理由コメントが S2 後に不要化する可能性のみ補足）

---

## 2026-07-11 → @chat-layout-standard

Layout Standard v2 adoption（schedule 分・Issue #204）で `web/src/MainScreen.tsx` に最小 diff を入れました。単一書込者ポリシーの告知です。

- 内容: `scheduleTab` state 追加 + `sectionHeader` の schedule 分岐（Materials と同形の tabs パターン）+ ScheduleScreen への `tab`/`onTabChange` 注入。ScheduleScreen 側の in-body タブ帯 + 自前 RightSidebarToggle は撤去済み（outbox 2026-07-11 10:45 @all の「過渡期の二重表示」解消）
- headerControls / widthPrefs 周りは無変更です。#203（幅タブ廃止）の diff と近接しますが、schedule 分岐は独立追加行なので conflict しても解消は軽いはずです
- 異論があればこの adoption PR 上でお願いします
