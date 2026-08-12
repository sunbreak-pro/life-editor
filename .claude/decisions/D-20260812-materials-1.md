---
id: D-20260812-materials-1
type: decision
status: answered
asked: 2026-08-12
answered: 2026-08-12
chat: materials-refine
answer: A
topics: [settings, localstorage, naming, migration, notes]
refs:
  [
    "#718",
    "#756",
    "shared/src/utils/resetPreferences.ts:11",
    "shared/src/hooks/notesUnifiedHelpers.ts:13-14",
    "web/src/notes/hooks/useNoteListState.tsx:25",
  ]
supersedes: []
superseded-by: []
implemented-by: []
promoted-to: null
---

# D-20260812-materials-1: #718 設定リセットの取りこぼしを「キー改名 + 移行」で直すか「例外リスト」で直すか

## 背景

（キュー原文 = `comm/decisions/chat-materials-refine.md`）

#718。`shared/src/utils/resetPreferences.ts:11` は localStorage のキーを **`life-editor-` / `life-editor:` の 2 接頭辞**だけで判定して消す。Notes の `note-tree-expanded` / `note-sort-direction`（`shared/src/hooks/notesUnifiedHelpers.ts:13-14`）は接頭辞なしなので網から外れ、mode 側（`life-editor:note-sort-mode`）だけ消えて半端な状態になる。

**実測で分かった追加の前提（Issue 本文より取りこぼしが広い）**: 全 localStorage キーを洗ったところ、消し残しは Issue の 2 個ではなく **7 個**あり、しかも**2 系統**に分かれる。

| 系統         | キー                                       | 定義箇所                                                          |
| ------------ | ------------------------------------------ | ----------------------------------------------------------------- |
| 接頭辞なし   | `note-tree-expanded`                       | `shared/src/hooks/notesUnifiedHelpers.ts:13`                      |
| 接頭辞なし   | `note-sort-direction`                      | `shared/src/hooks/notesUnifiedHelpers.ts:14`                      |
| 接頭辞なし   | `note-tag-groups-collapsed`                | `web/src/notes/hooks/useNoteListState.tsx:25`（**Issue 未記載**） |
| ドット区切り | `life-editor.shell.sidebar-collapsed`      | `shared/src/components/AppShell.tsx:115`                          |
| ドット区切り | `life-editor.shell.right-sidebar-width`    | `shared/src/context/RightSidebarContext.tsx:20`                   |
| ドット区切り | `life-editor.connect.pointGraph.positions` | `shared/src/components/Connect/graph/graphStorage.ts:7`           |
| ドット区切り | `life-editor.connect.pointGraph.viewport`  | `shared/src/components/Connect/graph/graphStorage.ts:8`           |

ドット区切りの 4 個は判断不要で直せる（`NAMESPACE_PREFIXES` に `"life-editor."` を足すだけ。改名なし = 保存値も消えない）。**割れるのは接頭辞なしの 3 個の扱いだけ**。

**A: 移行処理つきで改名する**。起動時に旧キーがあれば `life-editor:note-tree-expanded` 等へ書き写して旧キーを消す。

- 利点: 「接頭辞で判定する」規則に例外がゼロになる。以後、接頭辞なしのキーを新設したら lint / grep で機械的に検出できる
- 欠点: 移行コードが 3 キー分 + そのテストが要る。移行を通る前に一度リセットすると保存値が失われる（作者本人の実機 1 台が対象）。移行コードは「一度通ったら不要」なのに消す機会が無く、恒久的に残る

**B: `resetPreferences` に例外リストを持たせる**。接頭辞なしの既知キーを列挙して一緒に消す。

- 利点: 保存値が失われる経路がゼロ。差分が `resetPreferences.ts` 1 ファイルに閉じる。`notesUnifiedHelpers.ts:15-17` のコメント（改名しない理由）と矛盾しない
- 欠点: 「接頭辞で判定する」規則に穴が残る。新しく接頭辞なしのキーを足した人がリストへの追記を忘れると同じバグが再発する（実際 `note-tag-groups-collapsed` は Issue 起票時点で見落とされていた = この壊れ方は再現済み）

**放置時**: **何もしない（#718 を保留のまま次の作業へ）**。実装しない。

**期限感**: いつでも。

**補足（どちらを採っても要る作業）**: ドット区切り 4 個を拾う `"life-editor."` 接頭辞の追加と、`resetPreferences` の挙動を固定する vitest（全キーを並べて「消える / 消えない」を表明する形）。この 2 つは A/B のどちらに倒れても同じ差分になる。

## 選択肢と裁定

- A: **接頭辞なしの 3 個を `life-editor` 接頭辞つきへ改名し、起動時に旧キーから値を引き継ぐ移行処理を入れる**（**採用** — ユーザー回答 2026-08-12）。以後に追加するキーも「接頭辞で判定する」1 本の規則に自動で乗るため、列挙を更新し忘れる余地が構造的に無くなる。移行処理は役目を終えたら削除できる（残り続けるのは欠点ではなく、消す判断ができる形になっている）
- B: `resetPreferences` に除外リストを持たせる（却下 — 弱点が実測で裏付けられている。**`note-tag-groups-collapsed`（`web/src/notes/hooks/useNoteListState.tsx:25`）は #718 起票時点の列挙から漏れていた**。つまり「列挙を更新し忘れる」という B の唯一の弱点は、仮定ではなく既に一度起きた事故として観測されている。列挙で守る方式は、列挙が正しいことを人間が保証し続ける前提に立つため、同じ漏れが再発する）

## 却下案が復活する条件

移行処理の重さが実装時に見積もりを大きく超えたとき（3 キー分の書き写しに収まらず、値の形も変換が要ると判明した等）。その場合も「例外リスト」ではなく、規則側の再設計（キー生成を 1 箇所に集約する等）を先に検討する。

## 波及

- **#718 の 🛑 ゲートが解除される**（実装は別途。本裁定を記録した PR ではコードを触っていない）
- どちらに倒れても要る「ドット区切り 4 個の掃き取り」は PR #756 で先行して着地済み（`issue 718, partial`）。残るのは接頭辞なし 3 個の改名 + 移行 + `resetPreferences` の挙動を固定する vitest
