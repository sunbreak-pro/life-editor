---
Status: IN PROGRESS # enum のみ使用: Draft / IN PROGRESS / BLOCKED / COMPLETED / SUPERSEDED / DEFERRED / REFERENCE / ACTIVE (adopted policy)
Created: 2026-08-29
Branch: claude/connect-1171-tag-hub
Owner-chat: connect-refine
Previous: ./2026-08-29-connect-section-retirement.md
---

# Plan: Tag 起点の新 Connect セクション（Tag hub）を新設する

> 対応 Issue: #1171（`section:connect` / `type:feature` / `sev:important`）

---

## Context

- **動機**: #1152 で力学グラフごと退役した Connect の後継。全アイテムの関係を一枚の絵に描く代わりに、**タグを入口にしたハブページ**（Wikipedia のカテゴリページ型）で「このトピックの全体量と最近の動き」を読める形にする。#1153 で退役した Todo カンバンが持っていた「タグ軸で Todo を眺めて整理する」役割もここが引き取る
- **制約**:
  - **#1153 との役割分担**（2026-08-29 ユーザー確定）: 時間軸の入口 = Calendar / トピック軸の入口 = Connect。「今日への配置」導線は Calendar サイドバーの領分で、本セクションは**タグ軸の閲覧・整理に徹する**
  - `shared/src/components/Backlinks/**` と `shared/src/utils/itemLinks.ts` は**本レーンでは読み取り専用**（変更が要るなら `comm/outbox/` へ依頼を出す）。本計画はどちらも import しないので抵触しない
  - `web/src/MainScreen.tsx` は別レーン（#1199）が触る。セクション追加は registry + descriptor の 2 箇所で閉じるので**本計画は MainScreen を触らない**（`rules/frontend.md` §セクションを 1 つ足すときに触る 2 箇所）
  - DDL 変更ゼロ・完成までコスト $0
- **Non-goals**:
  - 力学グラフ / d3 の復活（#1152 の決定を覆さない）
  - hub 内でのアイテム編集（下の A-2 を参照）。タグ付け替えは既存の TagPicker / タグ編集モーダル（#409 / #740）の領分
  - `wiki_tags` / `wiki_tag_assignments` / `wiki_tag_connections` の DataService・サービス層への追加（既存の読み取りだけで足りる）
  - アイテム間リンク（`wiki_tag_connections`）の表示。hub は**タグ軸**であり、リンク軸は Notes の LinkPanel が担う

---

## 実測（着手前に確認した事実）

設計判断の根拠として、コードで確かめた点だけ残す。

1. **必要な読み取りは 4 本 + タグ側 3 本で、いずれも既存**: `fetchTodoTree()` / `fetchEvents()` / `listNotesUnified()` / `listDailiesUnified()`（`DataService`）と、`WikiTagsUnifiedProvider` が既に持つ `allTags` / `allAssignments` / `countsByTag`。**DataService への追加メソッドはゼロ**
2. `allAssignments` は**両側 live-only**（assignment 自身の `is_deleted` に加え `items_meta` を join してゴミ箱行も落とす = #365）。したがって「タグ無し = `allAssignments` に自分の id が現れないアイテム」で未分類バケツが正しく出る
3. **アイテムを開く導線は既存**: `useShellNavigation` の `navigateToItem({ id, role, date })` が note / daily / task / event の 4 role を既にサポートし、note・daily は Materials、task・event は Schedule へ飛んで対象を選択状態で開く（#285 / #370 / #503 / #1153）。hub 側は role 文字列を渡すだけでよい
4. **見た目の語彙も既存**: タグ行 = `TagHeadingIcon`（icon + color を 1 か所で解決）、種別チップ = `ItemRoleBadge` + `itemRole.ts` の `ITEM_ROLE_ORDER` / `ITEM_ROLE_ICON`（task / event / note / daily の 4 種を「アイコン形状 + 文字 + 色」の 3 冗長で示す a11y 契約つき）。**新しい視覚言語を作らずに済む**
5. 旧 Connect は `sections.ts` で materials の直後・`mobileOrder: 5`（= More の中）だった。同じ位置に戻せば、モバイル下部固定 4 タブ（briefing / schedule / materials / work）は動かない
6. `types/todoTree.ts:1-6` のコメントが「7 セクション（… / connect / …）」と**退役前の並びのまま**残っている（#1152 の消し漏れ）。本 PR で実態に合わせる

---

## 検討した代替案（必須）

| 案                                                                       | 採否 | 却下理由                                                                                                                                                                                                          | 復活条件                                                            |
| ------------------------------------------------------------------------ | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| A-1 マスター/詳細 2 ペイン（左 = タグ一覧 / 右 = 種類別のアイテム一覧）  | ✓    | —                                                                                                                                                                                                                 | —                                                                   |
| A-2 hub 内に詳細パネルを置き、その場で Todo の完了・タグ付け替えまでやる | ✗    | Issue の「タグ軸の閲覧・整理に徹する」と衝突し、同じ編集 UI が 3 画面目に増える。まず**閲覧の導線**を出して使用感を測る                                                                                           | 実使用で「開くたびに画面が飛ぶのが煩わしい」と判明したら別 Issue で |
| A-3 タグ一覧を出さず、全アイテムをタグ見出しでグルーピングして縦に並べる | ✗    | タグ数が増えるとページが縦に伸びるだけで「全体量を読む」目的に届かない。カテゴリページ型（一覧 → 選択）が Issue の指定                                                                                            | タグが常時 5 個以下に収まる運用に変わったら                         |
| A-4 未分類を「タグが 0 件のとき出る空状態メッセージ」で代替              | ✗    | Tag 起点一本化でタグ無しアイテムが**行方不明になるのを防ぐ**のが未分類バケツの役割で、空状態では辿れない（Issue で必須指定）                                                                                      | —                                                                   |
| A-5 `lazy()` + Suspense で code-split する                               | ✗    | 重いのは**ベンダースタック**（TipTap / recharts）であって画面数ではない。本 hub は React + 既存 lucide アイコンのみで、分割しても取り出せる重量が無いのに #1158 のアイドル先読み表と 2 箇所同期の維持費だけ増える | 将来 hub に重い依存（チャート等）を足すことになったら               |

---

## Scope (Touchable Paths)

```
shared/src/sections.ts
shared/src/components/TagHub/**              (新規 — 部品層)
shared/src/components/index.ts
shared/src/types/todoTree.ts                 (実測 6 のコメント修正のみ)
shared/src/i18n/locales/en.json
shared/src/i18n/locales/ja.json
shared/tests/sections.test.ts
shared/tests/tagHubModel.test.ts             (新規)
shared/tests/tagHubView.test.tsx             (新規)
web/src/connect/**                           (新規 — 画面ホスト層)
web/src/sectionDescriptors.tsx
web/tests/connectScreen.test.tsx             (新規)
.claude/CLAUDE.md                            (§8 の退役注記を更新)
.claude/rules/frontend.md                    (lazySections の注記を更新)
.claude/docs/requirements/mobile-scope.md    (#13 行)
.claude/docs/requirements/tier-2-supporting.md
.claude/docs/design/IA.md                    (退役注記を更新)
.claude/docs/design/briefs/connect.md        (退役注記を更新)
.claude/docs/vision/plans/2026-08-29-connect-tag-hub.md
```

### Issue の Scope 宣言との差分（明示）

Issue 本文の Scope は「docs 追随（CLAUDE.md §8・`mobile-scope.md` #13 行）」までを列挙している。ここに **`IA.md` / `briefs/connect.md` / `tier-2-supporting.md` / `rules/frontend.md` の 4 本を足した**。理由 = この 4 本は #1152 が「Connect は退役した」と現況として書き込んだ場所で、放置すると**セクションが実在するのに docs が「無い」と言う**状態になる（#1152 の計画書自身が「後続セッションが Connect を再追加しかねない」と書いて注記を入れた、その裏返し）。決定本文は書き換えず、**再新設の注記を継ぎ足すだけ**にとどめる（`rules/docs-consistency.md` §2 の歴史注記の作法）。

### スコープ外に出したもの（P-008 — 実装せずキューへ）

- `web/src/wikitag/TagPill.tsx` へのアイコン表示追加。Issue が「展開可否は計画書で判断」としていた点で、**判断 = 今回は入れない**。hub のタグ一覧と見出しは `TagHeadingIcon` で要件を満たし、TagPill は Notes / Todo / Event の**行内チップ**として別の密度制約を持つ。1 画面の要求で全画面のチップを変えると差分の性格が変わる
- hub からの Todo 完了トグル・タグ付け替え（A-2）
- **stale-while-revalidate（`useDomainLoad` の `snapshotKey`）の適用**。効かせるには `shared/src/state/domainSnapshotStore.ts` の閉じた union に slot を 1 本足す必要があり、Scope 外のファイルに手が伸びる。初回マウントのスケルトンは #1157 以前の全画面と同じ挙動なので、本 PR は付けずに出す（follow-up 候補）

---

## Steps

| #   | Step                                                                                                         | Gate    | Acceptance                                                   |
| --- | ------------------------------------------------------------------------------------------------------------ | ------- | ------------------------------------------------------------ |
| 1   | 部品層: `components/TagHub/` に純粋な導出（`buildTagHubModel`）と型 + labels 契約                            | 🤖 自律 | `shared/tests/tagHubModel.test.ts` 緑                        |
| 2   | 部品層: `TagHubView`（タグ一覧レール + 種類別グループ + 狭幅 2 画面遷移）                                    | 🤖 自律 | `shared/tests/tagHubView.test.tsx` 緑                        |
| 3   | registry: `sections.ts` に `connect` を materials の直後・`mobileOrder: 5` で追加（icon = `Tags`）           | 🤖 自律 | `shared/tests/sections.test.ts` が 8 セクションを pin して緑 |
| 4   | i18n: `connect.*` ブロック新設 + `section.connect` を en / ja に追加                                         | 🤖 自律 | en / ja のキー構造一致・i18n キーテスト緑                    |
| 5   | 画面層: `web/src/connect/ConnectScreen.tsx`（読み取り + labels 解決 + `navigateToItem` 配線）+ descriptor 行 | 🤖 自律 | `web/tests/connectScreen.test.tsx` 緑                        |
| 6   | docs 追随（Scope の 5 本）                                                                                   | 🤖 自律 | `LC_ALL=C bash scripts/docs-lint.sh` exit 0                  |
| 7   | CI `verify` ジョブ全ステップ + `docs-lint` をローカルで全通し                                                | 🤖 自律 | 全ステップ exit 0                                            |
| 8   | `origin/main` へ rebase してから PR 作成（#1171 参照）                                                       | 🤖 自律 | PR open                                                      |
| 9   | PR merge                                                                                                     | 🛑 人手 | ユーザーの merge ボタン（P-001）                             |

### Gate 凡例

- **🤖 自律** — Claude が完結。応答前に型検査 / テストを回して検証する
- **🛑 人手** — ユーザー操作必須（PR merge）

---

## Acceptance Criteria (機械検証可能)

- [ ] `SECTION_IDS` に `connect` が含まれ、canonical order が briefing / schedule / materials / **connect** / work / analytics / settings / trash（sidebar・mobile bottom bar・コマンドパレットはすべてここから派生）
- [ ] モバイル下部固定 4 タブが briefing / schedule / materials / work のまま（connect は More に入る）
- [ ] `buildTagHubModel` が (a) タグを count 付きで返す (b) 未分類バケツにタグ無しアイテムだけを入れる (c) 各タグのアイテムを `ITEM_ROLE_ORDER` の種類別に分ける — をテストで固定
- [ ] `TagHubView` がタグ選択で 4 種のグループ見出しとアイテム行を出し、行クリックで `onOpenItem({ id, role, date })` を role 付きで呼ぶ（Testing Library で画面ごと render して assert = `rules/frontend.md` の既定）
- [ ] タグ一覧・詳細見出しに `TagHeadingIcon`（`wiki_tags.icon` / `color`）が出る
- [ ] hub のどこにも「今日への配置」導線が無い（#1153 の領分）
- [ ] `shared/src/components/Backlinks/**` と `shared/src/utils/itemLinks.ts` の diff が 0 行
- [ ] `web/src/MainScreen.tsx` の diff が 0 行（#1199 と衝突しない）
- [ ] i18n の en / ja に `connect.*` と `section.connect` が同じキー構造で存在する
- [ ] CI `verify` ジョブの全ステップをローカルで再現して exit 0（shared → web → desktop → mcp-server）
- [ ] `LC_ALL=C bash scripts/docs-lint.sh` exit 0

---

## DB Migration Notes

DDL なし。既存の `wiki_tags` / `wiki_tag_assignments` と 4 ドメインの読み取りだけで完結する。

---

## Risks / Known Issues 参照

- **最大のリスク = 他レーンとの衝突**。`sectionDescriptors.tsx` は #1199（MainScreen）と近いが別ファイル。PR 直前に `origin/main` を取り込んでから出す
- `Record<SectionId, SectionDescriptor>` なので registry に足した瞬間に web がコンパイルエラーになる。**Step 3 と Step 5 は必ずセットで通す**（片方だけの中間 commit を作らない）
- jsdom にレイアウトが無いので、狭幅レイアウトの分岐は `useMediaQuery` の fallback（= wide）側しかテストで踏めない。狭幅の見た目確認は PR merge 後に chat-main が実ブラウザで行う（CLAUDE.md §7.4）
- `LC_ALL=C` 無しで `scripts/docs-lint.sh` を回すと日本語 Status 行が偽陽性になる（CLAUDE.md §7.1）

---

## References

- Issue: #1171 / 相手方 = #1152（削除・salvage）・#1153（役割分担）
- 前フェーズ計画書: [`2026-08-29-connect-section-retirement.md`](./2026-08-29-connect-section-retirement.md)
- 既存部品: `shared/src/components/tagEdit/`（#409 / #740 のタグ編集）・`shared/src/components/items/itemRole.ts`（#409 の種別契約）・`shared/src/components/TagHeadingIcon.tsx`（#311）
- 規約: [`rules/frontend.md`](../../../rules/frontend.md)（セクション追加の 2 箇所 / Provider 順序 / テストの既定）

---

## Worklog

- 2026-08-29: 着手前調査で「DataService への追加ゼロ・視覚言語も既存部品で足りる」ことを確認（実測 1 / 4）。A-5（code-split）は重いベンダー依存が無いので採らず、静的 import で入れる
