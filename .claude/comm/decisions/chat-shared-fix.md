# Decision Queue — chat-shared-fix

形式は [`README.md`](./README.md) 参照。回答は `ANSWERS.md` へ。

（2026-08-12 昇格分 = D-20260812-shared-fix-1 / D-20260812-shared-fix-2 — `.claude/decisions/` 台帳へ）
（2026-08-16 昇格分 = D-20260815-shared-fix-1 / D-20260816-shared-fix-1〜5 — 同上）
（2026-08-18 昇格分 = D-20260816-shared-fix-6（回答 = C・実装 = PR #1078 merged）— 同上）
（2026-08-19 昇格分 = D-20260818-shared-fix-1（回答 = A = rAF スロットル・実装 Issue #1103）— 同上。質問 / 転記 / 昇格は chat-main が代行した）
（2026-08-26 昇格分 = D-20260824-shared-fix-1（回答 = A = 日曜に揃える・実装 Issue #1138）— 同上。質問 / 転記 / 昇格は chat-main が代行した）
（2026-08-28 昇格分 = D-20260827-shared-fix-1（回答 = A = localStorage のまま）— 同上。質問 / 転記 / 昇格は chat-main が代行した）
（2026-08-30 昇格分 = D-20260830-shared-fix-1（回答 = C = ConfirmDialog に寄せる・実装は #1279 で schedule-refine 推奨）— 同上。質問 / 転記 / 昇格は chat-main が代行した）
（2026-09-02 昇格分 = D-20260901-shared-fix-1（回答 = A = 続きから再開・現状維持）/ D-20260901-shared-fix-2（回答 = B 相当 = 揃える・別 Issue #1442）— 同上。質問 / 転記 / 昇格は chat-main が代行した）

## 2026-09-05

### D-20260905-shared-fix-1: 残りの塗り disabled ボタン 7 箇所も `DISABLED_FILLED_BTN` へ揃えるか

- 背景: #1474（PR #1498）で `primary` と報告された保存ボタン 2 本だけを「沈んだ面 + リング」へ移した。同じ欠陥と同じ直し方を持つ塗りボタンが `Button.tsx:36`（danger）/ `schedule/EventEditorPane.tsx:452` / `schedule/ItemCreatePanel.tsx:264` / `schedule/TagFilterPanel.tsx:279` / `TodoAddDialog.tsx:129` / `TodoDetailPanel.tsx:194` / `web/src/notes/NotePasswordDialog.tsx:199` に残っている。単純な横展開に見えて、そうではない理由が 2 つある。(1) `danger` の disabled は TrashView / DeleteAccountDialog / AttachmentCleanupPanel で **「処理中」の意味**で使われており、灰色に沈めると「作動中」ではなく「無効になった」と読める。とくに NotePasswordDialog はスピナーもラベル差し替えも無く `aria-busy` だけなので、視覚的な手がかりがゼロになる。(2) `PomodoroSettings.tsx:472` のプリセット保存は枠線ボタン（塗り無し）で opacity のままが正しいため、揃えるほど**同じパネルに 2 種類の disabled 表現**が並ぶ
- A: 一括で揃える（推奨 — disabled の見た目が画面ごとに割れているのが元々の問題で、`danger` も報告と同じ欠陥を持つ。busy 表示の弱さは別 Issue でスピナー側を足して解く）
- B: `primary` だけで止める（現状 = PR #1498 のまま。busy 系の退行リスクをゼロにする代わり、`danger` の disabled は押せるように見えたまま残る）
- C: busy 専用の見た目を先に決めてから揃える（`disabled` と `aria-busy` を別の表現に分ける。いちばん正しいが Issue 1 本ぶんの設計判断が要る）
- 放置時: B のまま保留。PR #1498 が #1474 の DoD を満たしているので、無回答でも追加作業は発生しない
- 期限感: いつでも（#1474 の merge をブロックしない）
