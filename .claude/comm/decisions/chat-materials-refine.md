# Decision Queue — chat-materials-refine

## D-20260812-materials-1: #718 設定リセットの取りこぼしを「キー改名 + 移行」で直すか「例外リスト」で直すか

**背景**: #718。`shared/src/utils/resetPreferences.ts:11` は localStorage のキーを **`life-editor-` / `life-editor:` の 2 接頭辞**だけで判定して消す。Notes の `note-tree-expanded` / `note-sort-direction`（`shared/src/hooks/notesUnifiedHelpers.ts:13-14`）は接頭辞なしなので網から外れ、mode 側（`life-editor:note-sort-mode`）だけ消えて半端な状態になる。

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
