# 019: createPortal 配下の DOM が親ツリーから分離し、click-outside 判定が誤発火してポップオーバーが即閉じ

**Status**: Fixed
**Category**: Bug / Structural
**Severity**: Important
**Discovered**: 2026-04-25

## Symptom

`createPortal` で `document.body` 直下等にレンダリングしたポップオーバー / ドロップダウン / メニューを開いた直後、その中のクリックが「外側クリック」と誤判定されてパネルが即座に閉じる。トリガーボタンを押すと開いてすぐ閉じる、パネル内の項目をクリックしても選択前に閉じる、等。2026-04-25 / 04-26 の複数 UI 改修で横断的に再発した。

## Root Cause

click-outside 検出は通常 `ref.current.contains(e.target)` で「自分の DOM サブツリー内か」を判定する。しかし `createPortal` で描画した中身は **React ツリー上は子だが、実 DOM 上は別の場所（body 直下等）に分離**している。トリガー側コンポーネントの `ref` から見ると portal 中身は `contains()` で「外」と判定され、パネル内クリックが outside 扱いになって閉じハンドラが発火する。

## Impact

- ユーザー: ポップオーバー / メニュー / ドロップダウンが操作不能（開いた瞬間閉じる）。主要 UI コンテナ全般に影響しうる。
- 開発者: portal 化リファクタのたびに再発する構造的罠。1 箇所直しても別の portal 化箇所で再燃。

## Fix / Workaround

- portal 側のルート要素で、`isOpen` が true のときのみ native `mousedown`（capture phase で登録している click-outside リスナに対し）を `stopPropagation()` して、portal 内クリックが outside リスナへ伝播しないようにする（恒久対応）。
- もしくは click-outside 判定を「トリガー ref と portal ref の両方の `contains` を OR」する実装に統一する。
- 適用: 2026-04-25 / 04-26 のドロップダウン・パネル改修群。詳細は git 履歴 `git show <rev>:.claude/archive/2026-04-25-sidebar-tags-free-pomodoro.md` 他。

## References

- 関連ファイル: 共有ポップオーバー / ドロップダウン / メニュー（`createPortal` 使用箇所）、click-outside 共有 hook
- 関連 plan（削除済み・git 履歴）: `.claude/archive/2026-04-25-sidebar-tags-free-pomodoro.md` / `.claude/archive/2026-04-25-routine-group-migration.md` 周辺
- 関連 HISTORY: `.claude/HISTORY-archive.md` 2026-04-25〜04-26 セッション
- 関連規約: CLAUDE.md §6.4（主要 UI コンテナの背景透明禁止）と同じく「ポップオーバー / ドロップダウン / メニュー / ダイアログ / パネル」共通の落とし穴

## Lessons Learned

- `createPortal` を使う UI で click-outside を実装するときは、**React ツリーの親子と実 DOM の親子が一致しない**前提で判定を組む。トリガー ref 単独の `contains()` は必ず誤発火する。
- 共有 click-outside hook は portal 対応（trigger ref + portal ref の両 contains、または portal 側 stopPropagation）を標準実装にし、個別コンポーネントで再発させない。
- frontend-react-designer でポップオーバー / ドロップダウン / メニュー / ダイアログ / パネルを新規作成するときの必須チェックポイント。
- 検索キーワード: `createPortal` click-outside `contains` mousedown stopPropagation popover dropdown 即閉じ portal detached
