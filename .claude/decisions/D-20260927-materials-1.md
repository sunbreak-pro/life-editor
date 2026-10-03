---
id: D-20260927-materials-1
type: decision
status: answered
asked: 2026-09-27
answered: 2026-10-03
chat: materials-refine
answer: A
topics: [materials, notes, tags, schema]
refs: ["#2011", "#2094"]
supersedes: []
superseded-by: []
implemented-by: ["#2094"]
promoted-to: null
---

# D-20260927-materials-1: ノートの表にタグを付ける仕組みをどう持つか（#2011）

## 背景

（キュー原文 — 回答に伴いキューから削除）

- 背景: #2011 の「表に名前とタグ」のうち、名前は表ノードの属性 `name` として実装済み（PR は verify 後）。タグ（WikiTag）は `wiki_tag_assignments` が `items_meta.id` を参照する仕組みで、ノート本文の中の表はアイテムではないためそのままでは付かない。`/goal` の指示（新しいテーブル・migration・MCP の変更が要るなら P-008 でキューへ）に従い、この部分は実装しなかった。
- 放置時: 表のタグは実装しないまま（#2011 は名前・線・操作パネルの PR で close してよい）。
- 期限感: いつでも

## 選択肢と裁定

- A: 表を独立したアイテムにする（**採用** — ユーザー回答 2026-10-03 / Connect のタグ別一覧・`search_by_tag`・MCP から、ほかのタグ付きアイテムと同じ扱いで表を引けるのはこの形だけ。`items_meta` に表の role を足し、payload テーブルの DDL と MCP ツール対応が要る。別 Issue = #2094、`supabase db push` はこうだいさんの作業）
- B: 表ノードの属性に WikiTag の id の配列を持つ（却下 — DDL と MCP の変更は要らないが、表が Connect と `search_by_tag` に出ず、タグ削除時の id 後始末も要る）
- C: 表にはタグを付けない（却下）

## 却下案が復活する条件

表をアイテムにする DDL とバックフィルのコストが、Connect / MCP で引ける利点を上回ると実測で分かったとき。

## 波及

CLAUDE.md §4 の「5 role」前提が変わる。着手前に Plan Gate の計画書が要る（#2094）。#2011 は名前・線・操作パネルの PR で close 済み。
