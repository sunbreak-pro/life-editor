---
Status: In Progress (Steps 1–5 実装済 / Step 6 目視・Step 7 merge 待ち)
Created: 2026-06-16
Branch: claude/web-w6-master-detail-oflx4a
Owner-chat: web-w6-master-detail
Parent: ./2026-06-07-web-desktop-parity-roadmap.md
Previous: ./2026-06-15-web-parity-w5-app-shell.md
---

# Plan: Web/Mobile セクション内部深化 第1弾（W6・右サイドパネル / Master-Detail 3ペイン）

> 親ロードマップ `2026-06-07-web-desktop-parity-roadmap.md` の子計画書（W6・W6+ の第1スライス）。
> W5 で**アプリシェルの殻**（サイドバー / ボトムタブ）を Desktop 同等へ引き上げた。本書は
> シェルの内側＝**セクション本体の情報密度**を上げる W6+ の第1弾として、
> **広幅で「サイドバー＋リスト＋詳細」の3ペイン**を成立させる共有 Master-Detail プリミティブを新設し、
> **Notes をパイロット**として採用する。残りのセクション（Tasks 詳細 / Schedule カレンダー）は W7+ へ送る。

---

## Context

- **動機**: W5 で広幅レイアウトは「左サイドバー＋メイン1カラム」になったが、メインは依然**単一カラム**。旧 Desktop（`frontend/`）は「リスト＋右詳細ペイン」の3ペインで情報密度・回遊性が高い。特に **Notes** は web 側に既に選択状態（`notes.selectedNote` / `onSelect` / `key={selected.id}` でエディタを remount）があるのに、レイアウトが縦積みのため list と editor が同時に見えず、操作感が劣る。
- **到達基準**: 広幅で list↔detail が**同時に見えて行き来できる**（操作感・情報密度の同等。ピクセル一致は求めない。親書 Context 方針 2）。狭幅は detail をオーバーレイ（フルハイトのシート）で出す（2層モデルの「複雑画面 → Mobile 分割」の最小形）。
- **制約**:
  - コスト $0 厳守（DDL なし・新規依存なし。既存 `useMediaQuery` / `BottomSheet` で完結）。
  - 既存の不変式を維持: DataService 境界（§3.1/§6.4・getDataService 注入）、Provider ネスト順（§6.2）、section ルーティングは `useState`（§3.2・React Router 不使用）、新規 UI は `shared/src/components/` 集約（§6）、`notion-*` トークン厳守・主要 UI 背景に透明度禁止、i18n は props 注入（shared 内 `useTranslation()` 直呼び禁止）。
  - **選択状態はセクションが保持**（シェルへリフトしない）。`MasterDetail` は純粋表示で `master` / `detail` の2スロット + 開閉を受け取るだけ。「どの項目が選択中か」は各セクション（パイロットでは `NotesUnifiedProvider` の `selectedNote`）が持つ。
- **Non-goals**:
  - **Tasks 詳細パネル**（選択基盤の新設 + タスク詳細編集。`TaskTreeView` は TipTap detail pane を意図的に削除済 — コメント L27）→ **W7**。
  - **Schedule カレンダー充実**（週/日ビュー・時間グリッド・イベント DnD）→ **W8**。
  - リサイズ可能なペイン幅のドラッグ調整（旧 Desktop の `width` リサイズ）は本書では持たない（固定幅 + 折りたたみで足りる。必要なら W7+）。
  - `desktop/`（Electron）/ `mobile/`（Capacitor）包装自体の改変。各セクション本体のうち**パイロット以外**（Tasks / Daily / Schedule / Work / …）の改変。

---

## 中核設計：共有 Master-Detail プリミティブ + Notes パイロット

2層モデル（親書）に従い、**1 つの `MasterDetail` コンポーネント**が画面幅で広幅/狭幅を切替える（複雑画面の最小分割。`useMediaQuery` 駆動）。

| 幅 | レイアウト | detail |
| --- | --- | --- |
| **広幅（≥ md）** | `master`（リスト）と `detail`（詳細）の2カラム横並び。detail 未選択時はプレースホルダ（空状態コピー） | 右ペインに常時表示 |
| **狭幅（< md）** | `master` 単一カラム。項目選択で `detail` がフルハイトのシートでせり上がる（`BottomSheet` 流用・`env(safe-area-inset-*)`） | 選択時のみオーバーレイ |

- **props（純粋表示・DataService 非依存）**: `master: ReactNode` / `detail: ReactNode` / `detailOpen: boolean`（狭幅でシートを出すか＝選択の有無）/ `onCloseDetail: () => void`（狭幅シートの閉じる）/ `emptyDetail?: ReactNode`（広幅・未選択時のプレースホルダ）/ `detailTitle?: string`（狭幅シートの a11y タイトル・props 注入）。
- **シェルとの関係**: `AppShell` は**無改変**。`MasterDetail` は AppShell の `children`（＝セクション本体）の内側で各セクションが使う。広幅では「シェルのサイドバー｜master｜detail」で視覚的に3ペインになる（シェルに右ペインをリフトしない＝選択ローカリティと §3.1 境界を保つ）。
- **パイロット = Notes**: `NotesView` を `MasterDetail` で組み直す。`master` = 既存のノートツリー（`onSelect` で `selectedNote` 更新）、`detail` = 既存の `RichTextEditor`（`key={selected.id}` は維持）。`detailOpen = selectedNote != null`。空状態コピーは i18n。**`NotesUnifiedProvider` / 選択ロジック / エディタ本体には手を入れず、レイアウトの組み替えに徹する**。
- **デザインシステム再利用**: 既存 `useMediaQuery`（W5）/ `BottomSheet`（W3）/ `cn` を流用。新設は `MasterDetail` の1部品のみ。

---

## Scope (Touchable Paths)

```
shared/src/components/MasterDetail.tsx       ← 新設（広幅2カラム / 狭幅シートの純粋表示）
shared/src/components/index.ts               ← barrel export 追加
shared/tests/masterDetail.test.tsx           ← 新設（広幅2スロット / 狭幅シート開閉の最小 test）
shared/src/i18n/locales/en.json              ← 不足コピー（detail 空状態 / 詳細を閉じる 等）
shared/src/i18n/locales/ja.json              ← 同上（両 catalog 同キー）
web/src/notes/NotesView.tsx                  ← Master-Detail でレイアウト組み替え（パイロット）
.claude/docs/vision/plans/2026-06-16-web-parity-w6-detail-panel.md
.claude/docs/vision/plans/2026-06-07-web-desktop-parity-roadmap.md  ← W6 参照を1行追記
```

スコープ外の変更が必要になったら、本計画書を更新してから着手する（更新せず広げない）。

**対象外（明示）**: `frontend/`（FROZEN・参照のみ）/ `desktop/` / `mobile/` / `web/src/tasks/**`・`web/src/schedule/**`（W7/W8）/ パイロット以外のセクション / `NotesUnifiedProvider` 等の選択ロジック・`RichTextEditor` 本体 / `supabase/`（DDL なし）/ `AppShell.tsx`（W5・無改変）。

---

## Steps

| #   | Step                                                                                                  | Gate    | Acceptance                                                  |
| --- | ---------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------- |
| 1 ✅ | `MasterDetail` 新設（`useMediaQuery` で広幅2カラム / 狭幅 `BottomSheet`。props 注入・`notion-*`）       | 🤖 自律 | `cd shared && npm run build` exit 0                          |
| 2 ✅ | barrel export 追加（`shared/src/components/index.ts`）                                                 | 🤖 自律 | `cd shared && npm run build` exit 0                          |
| 3 ✅ | i18n: detail 空状態 / 「詳細を閉じる」等を en/ja 両 catalog に追加                                      | 🤖 自律 | 両ファイル同キー存在・`npm run build` exit 0                |
| 4 ✅ | `MasterDetail` 最小 test（広幅=2スロット同時描画 / 狭幅=選択でシート開・閉じる）                       | 🤖 自律 | `cd shared && npm run test` 全 pass                         |
| 5 ✅ | `NotesView` をパイロット採用（list=master / editor=detail。選択ロジック・エディタは無改変）            | 🤖 自律 | `cd web && npm run build` exit 0                             |
| 6   | レスポンシブ/操作感の目視（広幅3ペイン同時表示・狭幅シート開閉・ノート切替でエディタ remount 維持）     | 👀 目視 | 主要動線を手で1周（広幅/狭幅とも）                          |
| 7   | Draft PR → レビュー → main merge                                                                      | 🛑 人手 | PR レビュー & merge ボタン                                  |

### Gate 凡例

- **🤖 自律** — Claude 完結。後追い検証（tsc / test）で品質担保。Stop hook で型崩壊検出。
- **👀 目視** — レイアウト/体感は Claude では検証不能。ユーザーが画面で確認。
- **🛑 人手** — PR merge はユーザー操作必須。

---

## Acceptance Criteria (機械検証可能)

- [x] `cd shared && npm run build`（tsc -b）exit 0
- [x] `cd shared && npm run test`（vitest）全 pass（`MasterDetail` の最小 test 含む — 40 files / 436 tests）
- [x] `cd web && npm run build`（tsc -b --force && vite build）exit 0
- [x] `cd frontend && npm run build`（旧 Tauri 非破壊の担保・並立期間中）exit 0
- [x] `shared/src/i18n/locales/en.json` と `ja.json` で新規コピーキーが**両方**に存在（`notesView.detailEmpty` / `detailTitle` / `closeDetail`）
- [x] PR diff が ±400 行以内（374 insertions / 19 deletions）
- [x] git diff が Scope 宣言パス内のみ

---

## DB Migration Notes

- **なし**（DDL ゼロ。レイアウト層のみ。既存 `notes` / `items_meta` をそのまま使用）。

---

## Risks / Known Issues 参照

- **選択状態の所在**: シェルに右ペインをリフトすると §3.1 境界と選択ローカリティが崩れる。→ `MasterDetail` は純粋表示の2スロットに徹し、選択は**セクションが保持**（パイロットは既存 `selectedNote` を流用＝新規状態ゼロ）。
- **エディタの remount 破壊**: `RichTextEditor` は `key={selected.id}` で remount される設計（入力中の remount 防止のため title では keying しない — `NotesView` L254-257）。レイアウト組み替えで**この key 戦略を壊さない**（detail スロットに同条件で差し込む）。差し替え後に「ノート切替でエディタが入れ替わる / 入力中に消えない」を目視。
- **狭幅シートの高さ**: `BottomSheet` は既定で下からせり上がる。detail はフルハイト寄りが要るため `className` で `max-h`/`h` を調整（パネル不透明 §5 維持・backdrop のみ `bg-black/40` 例外）。
- **matchMedia のテスト環境**: `useMediaQuery` は W5 で jsdom 未定義時=広幅 fallback 済。`MasterDetail` test は W5 同様 `window.matchMedia` をモックして広幅/狭幅を固定。
- 着手前に `.claude/docs/known-issues/INDEX.md` を `detail` / `master` / `split` / `layout` で grep。

---

## References

- 親ロードマップ: `./2026-06-07-web-desktop-parity-roadmap.md`（W0〜W5・2層モデル・棚卸し）
- 直前: `./2026-06-15-web-parity-w5-app-shell.md`（AppShell / useMediaQuery / BottomTabBar）
- 移行 SSOT: `../../../2026-05-04-cross-platform-migration.md`
- frontend 規約: `../../../rules/frontend.md`（Provider 順序 / Pattern A / `notion-*` / i18n）
- 設計原則: `../coding-principles.md`（部品共通 / 画面分岐の2層モデル）
- 参照実装（FROZEN・読むだけ）: `frontend/src/components/Layout/`（`RightSidebar.tsx` / `MainContent.tsx`）・旧 Notes/Tasks の detail pane
- related skills: `lead-pipeline`（ティア判定）/ `role-pm → role-engineer → role-qa`（分解・実装・監査）/ `git-orchestrator`

---

## Worklog

- 2026-06-16（起草）: W5（シェルの殻）完了を受け、W6+ の第1スライスを「右サイドパネル / 3ペイン」に確定（ユーザー選択）。調査で **Notes は既に選択状態（`selectedNote`）を持つのにレイアウトが縦積み**＝低リスクで3ペイン化できると判明 → パイロットに採用。Tasks 詳細（選択基盤の新設要・TipTap detail 削除済）は W7、Schedule カレンダー充実は W8 へ送り。設計＝共有 `MasterDetail`（純粋表示2スロット・`useMediaQuery` で広幅2カラム / 狭幅 `BottomSheet`）。シェル（`AppShell`）は無改変、選択はセクション保持で §3.1 境界を維持。DDL ゼロ・新規依存ゼロ（$0）。本セッションの成果物は計画書のみ（実装は次セッション）。
- 2026-06-16（実装 / branch `claude/web-w6-master-detail-oflx4a`）: Steps 1–5 実装完了。`shared/src/components/MasterDetail.tsx` 新設（広幅 = `grid md:grid-cols-[1fr_1.4fr]` の master|detail 同時表示・未選択時は `emptyDetail` プレースホルダ / 狭幅 = `BottomSheet` で near-full-height（`max-h-[92svh]` + `env(safe-area-inset-bottom)`・閉じるボタンに `closeLabel` 注入）。純粋表示・DataService 非依存・`notion-*`・パネル不透明）。barrel + `index.ts` 経由でホストへ export。i18n は `notesView.detailEmpty` / `detailTitle` / `closeDetail` を en/ja 両 catalog に追加。`shared/tests/masterDetail.test.tsx` で matchMedia モック（広幅=master+detail 同時描画・未選択=placeholder / 狭幅=detailOpen でシート開・閉じるボタンで `onCloseDetail`）。`NotesView` をパイロット組み替え（list=master / editor=detail、`detailOpen = selectedNote != null`、`onCloseDetail = setSelectedNoteId(null)`、空状態 i18n）。**`NotesUnifiedProvider` / 選択ロジック / `RichTextEditor`・`NoteTitleInput` の `key={selected.id}` remount 戦略は無改変**（detail スロットに同条件で差し込み）。検証: shared build / shared test(436 pass) / web build / frontend build 全 exit 0。diff = scope 内のみ・374 insertions/19 deletions。残 = Step 6 目視（広幅3ペイン同時・狭幅シート開閉・ノート切替で editor remount 維持）/ Step 7 merge（人手）。
