---
Status: In-Progress — 実装は PR #49 マージ済（pass 1 静的修正）。残: モバイル崩れの 👀 目視 fix-pack（移行 SSOT Phase 2 完了判定の最後の 1 項目）
Created: 2026-06-06
Branch: feat/web-phase2-s9-mobile-responsive
Owner-chat: main
Parent: .claude/2026-05-04-cross-platform-migration.md (Phase 2 完了判定の 1 項目)
Previous: .claude/docs/vision/plans/2026-06-06-web-phase2-s8-realtime.md
---

# Plan: Web Phase 2 — S9 モバイルレスポンシブ（pass 1: 静的修正）

> Phase 2 完了判定「PC + Mobile の両方でレイアウトが崩れない」を満たす。**最終の崩れ判定は 👀 目視ゲート**（Claude は Chrome DevTools を自律操作できない）。本 PR は静的監査で確実な崩れだけを潰す pass 1。残りはユーザー目視で fix-pack を回す。

---

## Context

- **動機**: 本番 web (`web/`) は max-w-2xl の中央寄せシェル。375px（iPhone SE 幅）でヘッダー等が横詰めで溢れる。Phase 2 完了判定の最後の 1 項目。
- **制約**: コスト $0 / notion-\* トークン体系を尊重（§6.4）/ 機能・ロジックは変えずレイアウトのみ。
- **Non-goals**: モバイル専用 UI 再設計（それは prototype/ 系の別レーン）/ 全 breakpoint の網羅的最適化（pass 1 は確実な崩れのみ）。

---

## Scope (Touchable Paths)

```
web/src/MainScreen.tsx
web/src/wikitag/TagPicker.tsx
web/src/tasks/TaskTreeView.tsx
.claude/docs/vision/plans/2026-06-06-web-phase2-s9-mobile-responsive.md
```

---

## 監査の結論（375px 静的監査）

Explore で `web/src/` 全体を 375px 想定で監査。確実な崩れ・誤検知・許容を分類:

- **確実な崩れ（本 PR で修正）**:
  1. `MainScreen.tsx` ヘッダー — `flex justify-between`（flex-wrap なし）に nav 5 ボタン + email + Sign out。375px で内容幅 327px を超え溢れる。
  2. `wikitag/TagPicker.tsx` — ドロップダウンが `w-64`(256px) 固定 + `left-0`。インデントの深い行で画面外に溢れる。
  3. `tasks/TaskTreeView.tsx` ツールバー — `flex justify-between`（flex-wrap なし）に +Task/+Folder と Undo/Redo。
- **誤検知（修正不要）**: `NotesView` / `WikiTagsManagementView` / `LinkPanel` の `grid md:grid-cols-*` は Tailwind の `md:` 前置きで <768px は 1 列。375px で崩れない。
- **既存対応済（修正不要）**: `ScheduleView` / `ScheduleItemsView` / `DailyView` の作成フォーム行は既に `flex flex-wrap` で折り返す。Schedule/WikiTag の残りの横並びは `gap` + 短ラベル/`flex-1` 伸縮で許容範囲。

## 修正内容

1. **MainScreen ヘッダー**: `flex flex-wrap items-center justify-between gap-2`、nav も `flex flex-wrap`。email span に `max-w-[45vw] truncate ... sm:max-w-none`（375px で省略、sm 以上は全表示）。
2. **TagPicker ドロップダウン**: `w-64` に `max-w-[calc(100vw-2rem)]` を併記し画面内に収める。
3. **TaskTreeView ツールバー**: `flex flex-wrap items-center justify-between gap-2`。

---

## Steps

| #   | Step                                     | Gate    | Acceptance                                          |
| --- | ---------------------------------------- | ------- | --------------------------------------------------- |
| 1   | 375px 静的監査（Explore）                | 🤖 自律 | 崩れ候補リスト確定                                  |
| 2   | 確実な崩れ 3 点を修正（className のみ）  | 🤖 自律 | `web tsc -b --force` exit 0 / `eslint` 0            |
| 3   | PR 作成 → main merge                     | 🛑 人手 | PR レビュー & merge ボタン                          |
| 4   | Chrome DevTools で 375px / PC を目視確認 | 👀 目視 | 6 セクション（tasks/daily/notes/schedule/tags）巡回 |
| 5   | 目視で見つかった崩れの fix-pack          | 👀→🤖   | 追加 PR で反復                                      |

---

## Acceptance Criteria (機械検証可能)

- [x] `cd web && npx tsc -b --force` exit 0
- [x] `cd web && npx eslint <changed>` 0
- [ ] PR diff が ±60 行以内（pass 1。className のみ）
- [ ] (目視) 375px で各セクションのヘッダー・ツールバー・タグピッカーが画面内に収まる

---

## Risks / Known Issues 参照

- 静的監査だけでは「実際の体感崩れ」は完全に拾えない（だから 👀 目視ゲートを必須にする）。
- フォーム行は flex-wrap で折り返すが「縦長で詰まって見える」可能性 → 目視で気になれば `flex-col` 化を pass 2 で検討。

---

## References

- 移行 SSOT: `.claude/2026-05-04-cross-platform-migration.md`（Phase 2 完了判定）
- design: `frontend-react-designer` スキル（notion-\* トークン / a11y / motion）

---

## Worklog

- 2026-06-06: S8（PR #47）merge + 0017 本番適用後、最新 origin/main から S9 worktree を作成。Explore で 375px 静的監査 → grid 系誤検知を除外し、確実な崩れ 3 点に絞って修正（pass 1）。web tsc/eslint 緑。最終崩れ判定はユーザー目視（fix-pack 反復）。
