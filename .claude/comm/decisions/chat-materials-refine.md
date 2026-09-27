# Decision Queue — chat-materials-refine

形式は [`README.md`](./README.md) 参照。回答は `ANSWERS.md` へ。

（2026-08-12 昇格分 = D-20260812-materials-1 / D-20260812-materials-2・2026-08-16 昇格分 = D-20260815-materials-1 / D-20260815-materials-2・2026-08-19 昇格分 = D-20260816-materials-1（回答 = A）— いずれも `.claude/decisions/` 台帳へ。2026-08-19 分の昇格は chat-main が代行した）

（2026-09-02: #1439 の 4 点は `/goal` 指示で裁定権がレーンへ委任されたため、キューに open エントリを置かず `recorded` で直接台帳へ昇格した = [`D-20260902-materials-1`](../../decisions/D-20260902-materials-1.md)）

（2026-09-23 昇格分 = D-20260922-materials-1（回答 = A・#1843 の残作業）— 同上。質問 / 転記 / 昇格は chat-main が代行した）

### D-20260927-materials-1: ノートの表にタグを付ける仕組みをどう持つか（#2011）

- 背景: #2011 の「表に名前とタグ」のうち、名前は表ノードの属性 `name` として実装しました（ブランチ `claude/materials-2011-table-refresh`。PR は verify 完了後に開く）。タグ（WikiTag）は `wiki_tag_assignments` が `items_meta.id` を参照する仕組みで、ノート本文の中の表はアイテムではないため、そのままでは付きません。`/goal` の指示（新しいテーブル・migration・MCP の変更が要るなら実装せず P-008 でキューへ）に従い、この部分は実装していません。
- A: 表を独立したアイテムにする（推奨 — Connect のタグ別一覧・`search_by_tag`・MCP から、ほかのタグ付きアイテムと同じ扱いで表を引けるのはこの形だけのためです）。`items_meta` に表の role を足し、payload テーブルの DDL と MCP ツールの対応が要ります。別 Issue に切り、`supabase db push` はこうだいさんの作業になります。
- B: 表ノードの属性に WikiTag の id の配列を持つ。DDL と MCP の変更は要りません。ただし表は Connect や `search_by_tag` に出ず、表の名前の横にタグのチップが並ぶだけになります。タグを消したときに id が表に残る後始末も要ります。
- C: 表にはタグを付けない（名前だけで足りるとして見送る）。
- 放置時: 表のタグは実装しないまま（名前・線・操作パネルだけを入れた #2011 の PR で、#2011 を閉じてよい）。
- 期限感: いつでも
