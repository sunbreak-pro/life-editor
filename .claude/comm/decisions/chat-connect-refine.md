# chat-connect-refine decision queue

判断待ちを積む場所。書き込みは connect-refine のみ。回答は `ANSWERS.md`（こうだいさん）へ。

---

### D-20260829-connect-1: 退役で呼び出し元ゼロになった backlink 部品 3 つを、このまま保持するか削除するか

- 背景: #1152 / PR #1175。`BacklinkView`（→ `shared/src/components/Backlinks/`）と `backlinkSourceIds` / `resolveLinkId`（→ `shared/src/utils/itemLinks.ts`）は依頼どおり移設したが、削除前の全数 grep で **現行の呼び出し元は Connect 内部だけ**だったことが分かった。Issue 本文の「（LinkPanel が使用）」は実物と異なり、`web/src/wikitag/LinkPanel.tsx:126` は `useWikiTagsUnifiedContext().getLinksForItem()` から自前で読んでいる（`LinkPanel.tsx:52` の言及はコメント内の設計参照）。よって移設後の 3 つは**呼び出し元ゼロ**
- A: **保持する（現状・推奨）** — 「バックリンクを出す画面」は今後また要るはずで、移設済みの部品は次のホストの土台になる。維持費は約 190 行 + テスト 1 本と小さく、`shared/tests/backlinkView.test.tsx` が壊れれば気づける
- B: 削除する — `P-002`（呼び出し元ゼロの dead code は grep 全数実測を根拠に退役してよい）を素直に適用する。実測は PR #1175 本文に記載済みなので、根拠は揃っている
- 放置時: **A のまま（保持）**。追加の作業は発生しない
- 期限感: いつでも（PR #1175 の merge をブロックしない）
