---
Status: IN PROGRESS
Created: 2026-07-11
Branch: claude/layout-standard
Owner-chat: layout-standard # 共通部品実装の Worklog 記入者。計画作成 = docs-workspace
Parent: 2026-07-10-layout-unification-fanout.md
---

# Plan: Layout Standard v2 — 共通セクションヘッダー・rightSidebar 全画面化・幅切替タブ

> **本計画が要件 1〜5（2026-07-11 ユーザー提示）の仕様の正本**。各 worktree の orders 計画書・adoption Issue はここを参照する（転記しない — 数値の非複製原則）。要件 6（life-tags）は別計画 [`2026-07-11-life-tags-unification.md`](./2026-07-11-life-tags-unification.md)。

---

## Context

- **動機**: セクションごとにバラバラな「ヘッダーの作り（タイトル有無・区切り線有無）・rightSidebar の有無と開き方・コンテンツ幅」を全 7 セクションで統一し、どの画面でも同じ場所に同じ操作がある状態にする。v1（#180 merge 済・#181 adoption 進行中）の直上に積む第 2 弾
- **決定経緯**: 要件 1〜5 = 2026-07-11 ユーザー提示。「v2 先行・life-tags は別計画」= 同日 AskUserQuestion で確定
- **制約**: コスト $0 / shell 部品の単一書込者 = layout-standard worktree（v1 から承継）/ `frontend/` FROZEN / #181（v1 adoption）と並走 — v2 部品は v1 の成果（PageContainer・幅/gutter トークン）の上に実装する
- **Non-goals**: セクション中身の再デザイン（各 refine 計画の領分）/ life-tags（別計画）/ パネル開閉アニメーションの追加（現状 = 即時 mount/unmount を維持）/ mobile レイアウトの変更（MobileDrawer 方式は現状維持）

---

## 標準定義（Layout Standard v2）— 仕様の正本

> ユーザー要件との対応: 要件 1 → §3 / 要件 2 → §1・§2 / 要件 3 → §1・§3 / 要件 4 → §4 / 要件 5 → §5

### §1 共通ヘッダー行（全 7 セクション）

- 構成: **左 = セクションタイトル**（タブを持つセクションはタブ帯がタイトルを兼ねる）/ **右端（順序固定）= 幅切替タブ → rightSidebar トグル**
- ヘッダー行の直下に**全幅の区切り線**（`border-lumen-border` — v1 タブ帯の下線と同一トークン）。タブが無いセクション（work / settings / trash）にも同じ線を敷き、Schedule / Materials と見た目を揃える

### §2 Work のタイトル新設

- Work は現在タイトルが無くタイマー面から始まる。共通ヘッダー行の導入でタイトル（i18n `section.work`）+ 区切り線を新設する

### §3 rightSidebar 全セクション化

- 全 7 セクションのヘッダー右端にトグルを常設（`shared/src/sections.ts` の rightSidebar フラグ全 true 化 or フィールド廃止は実装判断）
- パネル内容が未定のセクション（analytics / trash）は**プレースホルダーパネル**で良い（中身は各 refine が後日定義 — 未定のまま進めて OK = ユーザー了承済み）

### §4 パネルの開閉位置

- トグルアイコンは**区切り線の上**（ヘッダー行内）に固定され、パネル開閉で位置が変わらない
- パネルは**区切り線の下**の領域でのみ開閉し、メインコンテンツを push して幅を狭める（push 方式は現行の RightSidebar 実装を維持・開始位置だけヘッダー下へ変更）。パネル下端は現状どおり画面下まで
- 含意: ヘッダー行は `main + RightSidebar` の flex 行の**外**に出る（AppShell の構造変更）

### §5 幅切替 2 段タブ

- 位置: rightSidebar トグルの**直左**（全セクション共通）
- 2 値: **wide「広い」= 全幅**（現 schedule / connect / materials→Tasks の見た目）/ **narrow「狭い」= reading 幅（`--container-lumen-reading`）中央寄せ**（現 work / settings / trash の見た目）。幅・gutter の実値は v1 のトークン（`shared/src/styles/tokens.css`）が正 — 本計画に生値は書かない
- 両方に**アイコン + ラベル**のセット（アイコン選定は実装判断・lucide から）
- 選択は**セクション単位で永続化**（localStorage — RightSidebar width と同じ流儀）。**初期値の正本 = 下表**（orders 側には転記しない）。初期値 = 現状の見た目:

| section   | 幅タブ初期値                                                        |
| --------- | ------------------------------------------------------------------- |
| schedule  | wide                                                                |
| materials | wide（サブタブ単位の扱いは未定事項参照）                            |
| connect   | wide ※                                                              |
| work      | narrow                                                              |
| analytics | wide ※（data 列 `--container-lumen-data` 維持 — v1 実装判断の継承） |
| settings  | narrow                                                              |
| trash     | narrow                                                              |

※ connect / analytics はユーザー要件 5 で例示されていないため、現状の見た目からの**推論値**（ユーザー確認前提 — 変更指示があれば本表のみ更新）

### 未定事項（未定のまま進めて OK・確定したら本節を更新）

- analytics / trash のパネル中身（プレースホルダーで可）
- materials の幅タブを「セクション単位」にするか「サブタブ単位」にするか（現状 Tasks=全幅・他 3 タブ=中央寄せ）→ layout-standard が materials-refine と outbox で調整
- narrow が成立しない画面（例: connect のグラフ・schedule の月表示）の扱い — adoption 時に各 refine が実測報告し、崩れる場合はそのセクションのみタブ無効化を検討
- 幅タブ・トグルの具体アイコン

---

## 実装分担

- **共通部品 = layout-standard worktree**（shell 単一書込者）: §1〜§5 の部品と配線。対象 Issue = v2 共通部品 Issue（Step 2 で起票）
- **adoption = 各 refine worktree**: 自セクションの独自ヘッダー/トグル配線の標準への移行・両幅での表示確認。手順 = 各 [`2026-07-11-<slug>-orders.md`](./) + v2 adoption Issue（Step 2 で起票）
- **trash** = 担当 worktree 無し → chat-main が采配 or 手すきの worktree が拾う（#181 と同じ扱い）

---

## Scope (Touchable Paths)

```
shared/src/components/**          ← 標準ヘッダー部品・幅タブ・RightSidebar 系（layout-standard のみ）
shared/src/sections.ts            ← rightSidebar フラグの扱い（layout-standard のみ）
shared/src/styles/tokens.css      ← 追加のみ（既存値変更は 🛑）
web/src/MainScreen.tsx            ← 配線（layout-standard のみ）
web/src/<section>/**              ← adoption（各 refine・自セクション配下のみ）
.claude/docs/vision/plans/2026-07-11-*.md
```

---

## Steps

| #   | Step                                                                                                                     | Gate                  | Acceptance                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------ | --------------------- | --------------------------------------------- |
| 1   | 本計画 PR merge（v2 仕様の承認）                                                                                         | 🛑 人手               | PR merge                                      |
| 2   | v2 Issue 2 枚起票（`[layout-standard]` 共通部品 / `[all]` adoption・label `shared-fix`。本文は本計画の標準定義から生成） | 🛑 人手承認 → 🤖 起票 | Issue URL 2 つ・本計画 References に追記      |
| 3   | 共通部品実装 → draft PR（layout-standard）                                                                               | 🤖 自律               | build/test/smoke pass（下記 Acceptance 準拠） |
| 4   | 共通部品 PR merge                                                                                                        | 🛑 人手               | merge                                         |
| 5   | 各 refine worktree が adoption（orders 計画書 + adoption Issue チェックリスト）                                          | 🤖 自律（各チャット） | adoption Issue 全行消化                       |
| 6   | 全画面 smoke + ユーザー目視（wide/narrow × パネル開閉の全組合せを主要画面で）                                            | 👀 目視               | console error/warning 0 + ユーザー OK         |

---

## Acceptance Criteria (機械検証可能)

- [ ] 全 7 セクションで、ヘッダー右端に「幅切替タブ + rightSidebar トグル」が表示される（playwright 巡回で機械確認）
- [ ] パネル open 時: ヘッダー行の幅・アイコン位置が不変 / パネル上端が区切り線の下 / メインコンテンツ幅が狭まる（overlay でない）
- [ ] 幅タブ切替がセクション単位で永続化され、リロード後も保持される
- [ ] `cd shared && npm run build && npm run test` / `cd web && npm run build` pass
- [ ] adoption Issue のチェックリスト全行消化 → close
- [ ] 完了時: 本計画 Status → COMPLETED + `archive/` 移動 + per-chat memory 更新（DoD）

---

## Risks / Known Issues 参照

- **#181（v1 adoption）との並走**: v2 部品が v1 部品を作り替える場合、v1 adoption 未消化のセクションは v2 でまとめて追随する（二度手間の回避は layout-standard の実装判断で明記）
- **shell 所有権競合**: app-integration チャット稼働時は AppShell / MainScreen の編集前に outbox 確認（v1 と同じ DoD）
- **worktree の .env.local 欠落**（memory `worktree-supabase-treeshake`）: dev 確認時は main の `web/.env.local` をコピー

---

## References

- 親計画（v1）: [`2026-07-10-layout-unification-fanout.md`](./2026-07-10-layout-unification-fanout.md) / v1 Issue: #180（merge 済）・#181（adoption 進行中）
- 各 worktree orders: `2026-07-11-<slug>-orders.md`（schedule / materials / connect / work / analytics / settings）
- 兄弟計画: [`2026-07-11-life-tags-unification.md`](./2026-07-11-life-tags-unification.md)
- タブ標準意匠: `.claude/docs/design/briefs/shell.md` §3 / トークン実体: `shared/src/styles/tokens.css`

---

## Worklog

- 2026-07-11: 計画作成（chat-docs-workspace）。ユーザー要件 1〜5 を精査し v2 標準定義として整理。進め方（v2 先行 + life-tags 別計画）を AskUserQuestion で確定。v2 Issue 起票は権限承認待ちのため Step 2 に配置
