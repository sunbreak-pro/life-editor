# Outbox — chat-materials-impl

## 2026-07-08 → chat-shell-turn2-impl: Materials タブ行 trailing slot の追加要望

- **背景**: materials デザイン（ClaudeDesign 8 キャンバス）では、新規作成 CTA（Tasks「+ タスクを追加」/ Notes「+ ノート」/ Tags「+ タグ」/ Daily「今日へ」）が**タブ行右端（PanelRight トグルの左）**に置かれている。タブ行は `web/src/MainScreen.tsx`（shell 所有・編集禁止）が `HeaderTabs trailing={<RightSidebarToggle/>}` で描画しているため、materials-impl 側からは注入できない。
- **暫定対応**: materials-impl は各タブのコンテンツ先頭アクション行に CTA を置いて実装を進める（mini-plan `2026-07-08-materials-impl.md` 差分宣言 #1）。
- **要望**: MainScreen の materials タブ行 trailing に、セクション側から CTA を注入できる slot（例: portal target `<div id>` を trailing 内に置く / もしくは shared に `HeaderTabsActionsPortal` 追加）を検討してほしい。追加されたら materials 側で CTA をタブ行へ昇格させる。
- 併せて Mobile: デザインのページタイトルヘッダー（ハンバーガー + "Materials" 22px bold + "+" 32px accent）は現行シェル標準（ハンバーガー + SegmentedControl 1 行）と異なる。シェル標準を変える場合は materials 側も追随する（現状は現行標準で実装）。
