# MEMORY (chat-briefing-section)

## 進行中

### ⏸️ Issue #391 — モバイルの夕刊タブでも宣言(intention)を編集可に（着手日: 2026-07-27）

**対象**: `shared/src/components/briefing/IntentionField.tsx`（新設）/ `BriefingView.tsx` / `EveningView.tsx`・`web/src/briefing/BriefingScreen.tsx`・`shared/src/i18n/locales/`・`.claude/docs/requirements/mobile-scope.md`

- 前回: 実装 PR #404 が merge 済み（本体は main 着地）。role-qa 独立監査で MAJOR 1（`tier-1-core.md` の「表示専用」記述がコードと矛盾）+ MINOR 1（wide の読み返しが保存値でなく生ドラフト）を受け反映
- 現在: **その監査反映 `8b16b349` が #404 merge 後 push で取り残された**（#394 → #399 と同型。照合を push 前にやり直さなかったのが原因）。cherry-pick した追随 **PR #406 が merge 待ち**（merge は🛑人手）。ゲートは shared 1166 tests / shared build / web build / **web eslint**（PR #402 で CI ゲート化）すべて exit 0
- 次: #406 merge 後に chat-main で狭幅の実ブラウザ検証（未宣言の日でも夕刊に入力欄が出る → 入力 → 朝刊へ切替えて同じ文面 → 再読込で保存確認 → wide の夕刊は読み返しのまま）。wide の read-only 据え置きは意図的（理由は PR 本文と `EveningViewProps.intentionEditable` の doc comment）

## 直近の完了

- Issue #370 — `[[link]]` autocomplete の候補プールに tasks を追加 ✅（2026-07-26・PR #394 merge 済み。role-qa 指摘反映分 `ecdede3d` は merge 後 push で取り残され、chat-main が PR #399 で cherry-pick して着地。`shared/src/utils/balanceByRole.ts` の存在で main 到達を実測確認・Issue closed）
- Issue #371 — 未保存の新規 Daily で挿入した `[[link]]` が Connect グラフに反映されない ✅（2026-07-26・PR #392 merge 済み・Issue closed・実ブラウザ検証は chat-main）
- Issue #366 — 編集中の Note が sidebar タググループ内で最上位へ跳ねる（updatedAt resort）✅（2026-07-26・PR #390 merge 済み・Issue closed・実ブラウザ検証は chat-main）

## 予定

（なし）
