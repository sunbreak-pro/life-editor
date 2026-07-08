---
Status: Draft — スケルトン起票（旧表記 SKELETON）・2026-05-26 起票（DU-F 実機確認時に発生したユーザー要件）。実装未着手。DU-G (Notes/Daily Unified write path 切替) と独立に進められる。**ClaudeDesign fan-out で前提 UI（リンク/タグの表示・遷移）が変わるため、着手前に fan-out 後の設計で再評価すること。**
Created: 2026-05-26
Branch: TBD（`enhance/link-ux-obsidian-style` 等を予定）
Owner-chat: TBD
Parent: .claude/archive/2026-05-21-data-unification-items-meta.md（親計画書「WikiTag/WikiLink」DoD の UX 拡張・archive 済）
Previous:
  - .claude/archive/2026-05-24-data-unification-f-wikitag-link-ui.md（DU-F、本要件の起点・archive 済）
Successor: 未定
継承する親章: 「採用アーキテクチャ」「DB 設計詳細」（wiki_tag_connections / items_meta）
---

# Plan: Link UX 強化（Obsidian 風 — cross-role link / 遅延実体化 / クリックで遷移）

## このフェーズのゴール

DU-F で実装した最小限の Link UX を、Obsidian 風の「呼び出すだけで生まれるリンク」へ進化させる。3 つの軸:

1. **Cross-role link**: Schedule（Event）から Note を選択可能にする等、4 role を跨いで linkable item を選択できる
2. **遅延実体化（lazy materialization）**: 未存在の名前で link を作成可能。後でクリックしたとき初めて items_meta + 該当 role の payload が実体化する（Obsidian の `[[New Page]]` 相当）
3. **Link クリックで遷移**: 既存 link をクリック→該当 item の詳細画面へ移動

## ユーザー要件（2026-05-26 起票時）

> Scheduleのリンクに Note のリンクを登録可能にする。またリンクを作成するとき、すでにないものでも new links として新しく作成ができ、またリンクをクリックすることでそのリンク先に移動することも可能にしてほしい。新しく作成する際は、クリックしたらそのリンクに当たるものが実体化するようにしてほしい（Obsidian 風）

## Non-goals（本計画の範囲外）

- frontend/（旧 Tauri）の修正
- リンクのグラフビュー可視化（親 Q12 通り backlink list のみ）
- Markdown 内 `[[...]]` syntax のパース統合（既存 NoteLink 機構は別レーン）
- Link の編集（label / alias）

## 採用案（叩き）

### 1. Cross-role linkable items の集約

**問題**: 現状の `LinkPanel.linkableItems` は role 単位で渡している（TaskTreeView は Tasks のみ、NotesView は Notes のみ）。Schedule から Note を選びたい場合に候補に出ない。

**案 A — Provider レベルで `useAllLinkableItems()` フックを新設**:

- 各 role の Context が空でない場合に collect → union 配列を返す
- 本来は items_meta から一括 fetch するのが理想（DU-G/H で `useItemsMetaSearch` 等として実装）
- MVP は各 role context が mount されている場合にのみ取得（mount されていない role は候補に出ない）

**案 B — items_meta から逐次検索**:

- LinkPanel のテキスト入力で 300ms debounce → `items_meta` を `name ilike` 検索
- role / payload テーブルから title 補完
- 案 A より重いが正しい設計（DU-G/H で payload にも title カラムが揃った後に実装）

**判断**: MVP は **案 A**。長期的には案 B。

### 2. 遅延実体化（lazy materialization）

**問題**: 未存在の id を入力して link を作成すると、現状は items_meta に存在しないので RLS で 403（DU-F で確認済）。

**案**: 新規入力した「リンク名」（id ではなく表示名）を以下のように処理:

1. ユーザーが LinkPanel の入力欄に存在しない名前を入力 → `+ Add` クリック or Enter
2. `linkable_stubs` (新規テーブル or `items_meta.role='stub'`) に最小 row を作成
   - id = `stub-<uuid>` / role = 'stub' / title = 入力名 / payload テーブル不要
3. `wiki_tag_connections` の to_item_id にその stub id をセット → 既存 RLS をパス
4. UI 上は stub link を「💭」アイコン等で「未実体化」と表示
5. 後でユーザーが stub link をクリック → 「Note として実体化」「Task として実体化」等のメニューを出す
6. 実体化選択 → items_meta.role を 'note' 等に変更 + 該当 payload テーブルに row 作成 + UI 上は通常 link 扱い

**設計判断ポイント**:

- stub を items_meta に混ぜるか別テーブルか（混ぜると role enum に 'stub' 追加 + RLS 拡張 / 別テーブルは migration 増えるが分離しやすい）
- stub の RLS は items_meta と同じ `auth.uid() = user_id`
- 実体化時の id 変更は FK cascade で wiki_tag_connections が自動で追従するなら id 維持で OK / 維持できないなら新規 id 採番 + 古い stub 削除 + link 張り替え
- 実体化時、Task / Note / Daily のどれに化けるかは UI で選択（modal）

### 3. Link クリックで遷移

**問題**: 現状 LinkPanel は link を表示するだけで、クリックしても遷移しない。

**案**:

- `<a>` ボタンに置き換え、`onClick` で `setSection(role)` + `setSelectedItemId(id)` を発火
- 各 role の Context は selectedItemId を受け取って自動で該当 item を選択状態にする
- `MainScreen` が「target item id」をグローバル state で持ち、section 切替時に伝搬

**設計判断ポイント**:

- React Router を入れるかどうか（CLAUDE.md §3.2 は無し方針 → state lifting で対応）
- 遷移時に scroll / focus 制御をどこまでやるか（MVP は section 切替のみ、scroll は後追い）
- 遷移先がまだ load されていない場合の loading state

### 4. 既存 wiki_tag_connections のままで足りるか

| 要件               | 既存 schema で対応可？    | 必要な拡張                           |
| ------------------ | ------------------------- | ------------------------------------ |
| Cross-role link    | ✅ items_meta.id 単一空間 | なし                                 |
| 遅延実体化（stub） | ❌                        | role='stub' or 新テーブル            |
| クリック遷移       | ✅ UI 層のみ              | なし                                 |
| Link label / alias | ❌ (to_item_id のみ)      | wiki_tag_connections に label カラム |

## Steps（暫定、実装時に再見積もり）

1. **Cross-role linkable items 集約**: 4 role の Context value から union を作る utility hook 新設
2. LinkPanel の `availableItems` を全 role 横断に変更
3. **Stub 実体化の設計確定**: items_meta に 'stub' role を追加するか / 別テーブルにするか（migration あり）
4. stub 用 RLS policy 追加（migration）
5. `SupabaseWikiTagsUnifiedService` に `createStubItem(id, title)` + `materializeStubToRole(id, role)` 追加
6. `useWikiTagsUnifiedAPI` の `createItemLink` を「未存在 id ならまず stub 作成」に拡張
7. **Link クリック遷移**: MainScreen に `pendingTargetItemId` state 追加 / 各 role Context が受け取って selectedItemId 同期
8. LinkPanel の出力リンクを `<button>` 化 → onClick で section 切替 + 選択
9. 未実体化 link の UI（💭 アイコン + ホバーで「クリックで実体化」ヒント）
10. 実体化選択 modal（Note / Task / Event / Daily から選ぶ）
11. golden path 動作確認 + テスト追加

## Acceptance Criteria（機械検証可能、暫定）

- [ ] Schedule タブから Note を link 先候補に選べる（datalist or autocomplete に出る）
- [ ] LinkPanel の入力欄に存在しない名前を入力 → Add → 「💭 未実体化」状態で link が作成される
- [ ] 未実体化 link をクリック → 実体化 modal が開く → role 選択 → 通常 link 扱いに変わる
- [ ] 既存 link をクリック → 該当 item の section に切替 + 選択状態になる
- [ ] cd shared && npx tsc -b exit 0 / vitest 緑
- [ ] cd web && npm run build exit 0
- [ ] RLS gate offender 0 / advisor lint 新規 WARN 0
- [ ] 親計画書 DoD の「backlink list がアイテム詳細から表示可能」は維持

## DB Migration Notes

**追加 DDL が必要**:

- `items_meta.role` enum に 'stub' を追加 OR 新 table `wiki_tag_stub_items` 新設
- どちらの場合も RLS 4 policy × 1 = 4 policy 必須
- 既存 wiki_tag_connections の FK が items_meta(id) なので stub を items_meta に混ぜる方が薄い

migration 適用は user が `supabase db push` で実施（CLAUDE.md §7.3 / DB Migration Notes）。

## Risks & Mitigations

| ID  | リスク                                                                              | レベル | 緩和策                                                                                         |
| --- | ----------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| R1  | role='stub' を items_meta に混ぜると既存 query (`role='note'` 等) が漏れる          | 中     | 既存 query を全て監査 + stub を default で除外。`life-editor-sync-auditor` で再発検出          |
| R2  | 実体化時の id 維持は migration policy 依存（FK cascade）。id 変更が必要なら張り替え | 中     | 設計確定時に「id 維持で実体化」を採用するか「新 id + 旧 stub 削除 + link FK 張り替え」を決める |
| R3  | Cross-role link で別 role の payload を fetch する必要が出る（title 解決）          | 中     | 各 role の Context が mount 時に title cache を提供 → LinkPanel の resolver に injection       |
| R4  | クリック遷移で複数 section provider が unmount → 状態消失                           | 中     | MainScreen が `pendingTargetItemId` を global state で保持 / section 切替後に Context に伝搬   |
| R5  | 未実体化 link が大量に残るとゴミになる                                              | 低     | Settings → Cleanup で「未実体化 link を一括削除」ボタン提供（MVP では不要）                    |
| R6  | Obsidian と挙動差で混乱（Obsidian は `[[]]` 構文 / 本機能は LinkPanel 入力）        | 低     | UI 側で「Obsidian-style new link」ヒント文を表示                                               |

## References

- vision: `.claude/docs/vision/db-conventions.md` (items_meta + payload 規約) / `.claude/docs/vision/coding-principles.md`
- 親計画書: `.claude/docs/vision/plans/2026-05-21-data-unification-items-meta.md`
- 起点: `.claude/docs/vision/plans/2026-05-24-data-unification-f-wikitag-link-ui.md` (DU-F)
- 並走候補: `.claude/docs/vision/plans/2026-05-25-data-unification-g-notes-daily-unified.md` (DU-G、Notes/Daily Unified write path)

## Worklog

実装中に判明した設計判断や、計画から逸脱した部分を時系列で記録。

- **2026-05-26** — DU-F 実機検証 OK 後にユーザーから起票。実装未着手。設計判断（stub を items_meta に混ぜる / 別テーブル）は実装着手時に再検討。
