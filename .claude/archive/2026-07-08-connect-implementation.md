---
Status: COMPLETED — PR #167 merged（2026-07-08）。enum 正規化 + archive 移動 = 2026-07-11 #173 docs-lint 導入時
Created: 2026-07-08
Branch: claude/connect-impl
Owner-chat: connect-impl
Parent: .claude/docs/vision/plans/2026-07-05-design-implementation-fanout.md
---

# Plan: Connect — target IA implementation (ClaudeDesign import)

> fan-out オーダー connect-impl の mini-plan。デザイン正本 = ClaudeDesign import 2 枚
> （Desktop = `ConnectFrame2.dc.html` / Mobile = `ConnectMobile.dc.html`、scratchpad 保存済み）。
> 要件分解は role-pm 完了済み（2026-07-08）。本ファイルはその凝縮 + 決定事項の固定。

---

## Context

- **動機**: Connect 画面（グラフ + バックリンク）を生成デザインの target IA に揃える。現状はフロート HUD + 常設 w-64 バックリンク + フロート設定パネルで、shell Turn 2 標準（rightSidebar 320px 押し込み式）と不整合。Mobile は Desktop 縮小のみで touch 非対応
- **制約**: 単一書込者原則 — シェル部品（AppShell / RightSidebar* / MobileDrawer / HeaderTabs / SegmentedControl / RightSidebarToggle）と `web/src/MainScreen.tsx` は shell-impl 所有・**編集禁止**（import は可）。変更要望は outbox `.claude/comm/outbox/chat-connect-impl.md` に append
- **Non-goals**: グラフ本体の再実装（Canvas 2D + d3-force を維持。デザインの SVG は静的モック）/ MainScreen の 1 行ヘッダー統合（outbox 要望に分離）/ shell 部品の改修

### 決定事項（PM 質問 A/B の裁定・2026-07-08）

- **A（Mobile の詳細/設定）**: デザイン優先。ピークシート（非モーダル・タブバー上）+ 設定モーダルボトムシートを Connect 自前で実装。shell ハンバーガー drawer は使わない（空 drawer 問題は outbox 要望で shell に相談）
- **B（Desktop ヘッダー）**: 2 行構成（上段 = shell の sectionToolbar トグル行 / 下段 = Connect 自前ヘッダー行）。Connect ヘッダーの reheat / 全体表示は右端に置き上段と視覚的に揃える。1 行化は outbox 要望に分離

---

## Scope (Touchable Paths)

```
shared/src/components/Connect/**
shared/src/i18n/**            # en/ja catalog への connect.* キー追加のみ
web/src/connect/**
.claude/docs/vision/plans/2026-07-08-connect-implementation.md
.claude/memory/chat-connect-impl.md
.claude/history/chat-connect-impl.md
.claude/comm/outbox/chat-connect-impl.md
```

---

## 変更ファイルマップ（role-pm 成果物の凝縮）

### 改修

| ファイル                            | 変更                                                                                                                                |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `Connect/ConnectGraphView.tsx`      | ルート再編: Desktop ヘッダー行 + 凡例 + ズームピル + 状態分岐（loading/empty/nomatch/error）+ RightSidebarPortal 注入 + Mobile 分岐 |
| `Connect/GraphControlPanel.tsx`     | フロート枠（absolute / 外側クリック閉じ / 閉じ X / panel-toggle marker）を撤去し rightSidebar タブの純中身へ                        |
| `Connect/BacklinkView.tsx`          | 常設 `aside w-64` 枠を撤去し rightSidebar「バックリンク」タブの中身へ（選択ノードカード + 「このノートへのリンク」リスト意匠）      |
| `Connect/GraphTopBar.tsx`           | フロート HUD → Connect ヘッダー行へ作り替え（or `ConnectHeader.tsx` 新設で置換・廃止）                                              |
| `Connect/SelectedNodeCard.tsx`      | Lumen カード語彙に寄せる + 「バックリンク N」リンク追加（クリック → rightSidebar open + バックリンクタブ）                          |
| `Connect/graph/useGraphFilters.ts`  | `panelOpen`/`togglePanel`/`closePanel` を撤去し shell の `useRightSidebarContext` に一本化                                          |
| `Connect/labels.ts`                 | 新ラベル型追加（下記 i18n キー分）                                                                                                  |
| `Connect/index.ts`                  | 新規部品の re-export                                                                                                                |
| `web/src/connect/ConnectScreen.tsx` | labels に新キー注入 + 初回フェッチ未完フラグ（loading 起点。EMPTY_STATIC 開始による一瞬空表示バグの解消）                           |

### 新規

| ファイル                                | 役割                                                                                           |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `Connect/GraphLegend.tsx`               | 種別凡例チップ（色ドット + lucide アイコン + ラベル ×4。Desktop 左上 / Mobile 横スクロール行） |
| `Connect/GraphStates.tsx`               | loading / empty / nomatch 共通意匠（Desktop/Mobile 共用）                                      |
| `Connect/ConnectSidebarPanel.tsx`       | rightSidebar 内「グラフ設定 / バックリンク」2 タブ切替コンテナ                                 |
| `Connect/mobile/NodeDetailSheet.tsx`    | Mobile 非モーダルピークシート（つながり/バックリンク 2 タブ + ローカル深度 + リンク追加/削除） |
| `Connect/mobile/GraphSettingsSheet.tsx` | Mobile 設定モーダルボトムシート（検索/種別/タグ/表示/力学スライダー・黒 30% スクリム）         |
| （任意）`Connect/ZoomPill.tsx`          | 右下ズームピル（小物。ConnectGraphView インライン可）                                          |

### rightSidebar 統合（shell Turn 2 標準・MainScreen 無編集で成立）

- `RightSidebarProvider` は MainScreen が mount 済み → Connect は再 mount しない
- `<RightSidebarPortal>` の children に `<ConnectSidebarPanel>`（2 タブは Connect local state）
- 開閉 `isOpen` は shell 所有。Connect は `useRightSidebarContext()` の `open()` を呼ぶだけ
- `RightSidebarToggle` は MainScreen が sectionToolbar に描画済み → Connect 側では出さない
- `Cmd+F` 導線（ConnectGraphView.tsx:191-195）は「rightSidebar open() + グラフ設定タブ + 検索フォーカス」に張り替え

### i18n 追加キー（en/ja 両 catalog・labels props 経由）

`connect.graph.loading` / `connect.empty.title` / `connect.empty.hint` / `connect.sidebar.settingsTab` / `connect.sidebar.backlinksTab` / `connect.sidebar.incomingLinks` / `connect.graph.viewBacklinks` / `connect.graph.zoom` / `connect.mobile.linksTab` / `connect.mobile.backlinksTab` / `connect.mobile.settingsTitle` / `connect.mobile.searchPlaceholder` / `connect.search.noMatch` / `connect.search.clear` / `connect.graph.fitView`（既存 `resetView` と重複なら流用可）。文言の en/ja 実値は role-pm 出力を engineer 指示に同梱。既存 `typeProject/typeNote/typeDaily/typeTag` は凡例に流用

### トークン対応

- デイリー藍 `#5b6cdb`(light)/`#818cf8`(dark) = **`--color-chip-routine-dot`**（`graph/graph-theme.ts:30` の `dailyDot` が既に参照）。新規 UI もこのトークン経由・hex 直書き禁止
- デザイン内のカテゴリ 10 色は `node.color` 経由のデータ側由来（UI ハードコードではない）

---

## Steps

| #   | Step                                                                                                                              | Gate    | Acceptance                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------- |
| 1   | mini-plan 作成（本ファイル）                                                                                                      | 🤖 自律 | 済                                                                               |
| 2   | Engineer A: labels/i18n + 状態部品 + 凡例/ズームピル + Desktop ヘッダー + rightSidebar 2 タブ + SelectedNodeCard（PM タスク 2-7） | 🤖 自律 | `cd shared && npm run build && npm run test` / `cd web && npm run build` 全 pass |
| 3   | Engineer B: Mobile（ピークシート + 設定ボトムシート + 凡例行 + 状態）+ barrel/hex/仕上げ（PM タスク 8-9）                         | 🤖 自律 | 同上 + 新規ファイル hex grep 0                                                   |
| 4   | session-verifier + role-qa 独立監査                                                                                               | 🤖 自律 | 指摘ゼロ or 反映済み                                                             |
| 5   | task-tracker END + draft PR + outbox append                                                                                       | 🤖 自律 | PR `feat: connect — target IA implementation (ClaudeDesign import)` 作成         |
| 6   | PR merge                                                                                                                          | 🛑 人手 | ユーザー merge                                                                   |

---

## Acceptance Criteria (機械検証可能)

- [ ] `cd shared && npm run build` exit 0
- [ ] `cd shared && npm run test` 全 pass
- [ ] `cd web && npm run build` exit 0
- [ ] 新規/変更コンポーネントに hex 直書きなし: `grep -rE "#[0-9a-fA-F]{3,8}" shared/src/components/Connect/` = 0（graph-theme.ts の既存 fallback 定数は除く）
- [ ] i18n 新キーが en / ja 両 catalog に存在
- [ ] シェル部品 + `web/src/MainScreen.tsx` に diff なし（`git diff --stat` で確認）
- [ ] draft PR 作成済み（self-merge しない）

---

## Risks / Known Issues 参照

- panelOpen 二重管理（useGraphFilters vs shell isOpen）→ shell に一本化。Cmd+F 導線の張り替え漏れに注意
- IME: Mobile 検索/リンク追加入力の keydown に `e.nativeEvent.isComposing` チェック必須（SelectedNodeCard.tsx:188 踏襲）
- Mobile で RightSidebarPortal を出さない → ハンバーガー空 drawer（許容・outbox 要望）
- loading 起点は ConnectScreen 側の「初回フェッチ未完」フラグ（データ注入契約は維持）

---

## References

- fan-out 計画書: `.claude/docs/vision/plans/2026-07-05-design-implementation-fanout.md`
- design brief: `.claude/docs/design/briefs/connect.md` / IA: `.claude/docs/design/IA.md`
- デザイン実体: scratchpad `ConnectFrame2.dc.html` / `ConnectMobile.dc.html`
- 実装規約: `.claude/rules/frontend.md`

---

## Worklog

- 2026-07-08: role-pm 要件分解完了（セッション制限中断 → 再開で回収）。質問 A = デザイン優先（Mobile 自前シート）/ B = 2 行構成 で裁定し本プラン確定
- 2026-07-08: Engineer A（Desktop）→ Engineer B（Mobile）→ role-qa（PASS with nits・Should-fix 反映）→ draft PR #167 作成。AC 全項目 pass（build/test/hex 0/i18n 両 catalog/shell diff 0）。merge + 実画面目視（rightSidebar 2 段ヘッダー・Mobile ヘッダー並び）はユーザーゲート。plan の archive/ 移動は merge 後
