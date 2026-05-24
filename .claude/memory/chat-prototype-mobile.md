# MEMORY (chat-prototype-mobile)

## 進行中

（なし）

## 直近の完了

- Phase 3.A〜F: prototype/mobile-ui mock CRUD + 6 screens 一気通貫実装 ✅（2026-05-24）

## 予定

- 🐛 Phase 3.G fix-pack (次セッション着手): ユーザーテストで発見された 3 件を一括対応
  1. **リンク遷移先ずれ**: Materials Editor の `[[link]]` や CrossSearch の結果行をクリックすると意図したアイテムではなく 5 月の Calendar ビューに飛ぶ。ScheduleScreen が `?focus=<id>` を未実装で、month/day がズレている。MaterialsScreen から `nav('/schedule?focus=<id>')` で渡している id を ScheduleScreen 側で受信 → 対象 ScheduleItem を find → `anchorDate` を `due` に合わせ、`view='three'` or DayDetailSheet 起動でハイライトする。Note への遷移 (`/materials?open=note-xxx`) も同様に MaterialsScreen 側で受信ハンドリング必要
  2. **ThreeDayView sticky header が編集モーダル上に被る**: ThreeDayView から item タップで AddEventModal を開くと、ThreeDayView 上部の sticky 日付ヘッダー (`sticky top-0 z-10`) がモーダルタイトル領域にオーバーレイ。`AddEventModal` の z-index を明示的に上げる (`z-50` 等) か、`fixed inset-0` ベースで stacking context を切る
  3. **iOS Safari の auto-zoom 抑止 + 拡大縮小禁止**: title input / body textarea にフォーカスすると自動ズーム (font-size < 16px が原因)。基本方針: 「現在のスクリーンは拡大・縮小ともに行わない」。対応案 2 通り: (a) `index.html` の viewport meta に `maximum-scale=1, user-scalable=no` 追加 (b) 全 input/textarea を font-size >= 16px に統一。両方の併用も検討。プロトタイプは a11y より「想定外ズームなし」の体験優先で OK
- 👀 残: 6 screens 全体の他不具合洗い出し (上記 3 件以外あれば次回 fix-pack に追加)
- Phase 3.F PR 作成 (🛑 人手 Gate): `prototype/mobile-ui` → `refactor/web-first-v2` (fix-pack 完了後)
- 別件: Supabase migration `items_meta_id_role_uk` drop 失敗の対応 (別 worktree / 別 branch スコープ)
