# 018: macOS WebKit で `<button>` クリックが focus を奪わず、autoFocus input の blur ハンドラが先に発火

**Status**: Fixed
**Category**: Bug / Structural
**Severity**: Important
**Discovered**: 2026-04-26

## Symptom

WikiTag 等、`autoFocus` した `<input>` を持つパネル内で、パネル内のボタン（追加 / 確定 / トグル等）をクリックしても押下が効かない、または input の `onBlur`（パネルを閉じる / コミット）が先に走ってボタンの `onClick` に到達しない。Chromium / Tauri Linux/Windows では再現せず **macOS WebKit (WKWebView) でのみ**発生。

## Root Cause

macOS の WebKit は、`<button>`（および一部のフォーカス不能要素）をクリックしても **クリック先要素へ focus を移動しない**仕様差がある。結果:

1. `autoFocus` の input がフォーカスを保持したまま、
2. ボタンへの `mousedown` → input から focus が外れる扱いで input の `onBlur` が先に発火、
3. `onBlur` がパネルを閉じる / state をリセットするとボタンの `onClick` がもう存在しない DOM 上で失われる。

「クリックしたのに input の blur 副作用だけが起きてボタン動作が消える」順序バグ。

## Impact

- ユーザー（macOS、本プロジェクトの主環境）: フォーム系パネルのボタンが体感的に「効かない / 1 回目が無視される」。再現条件が分かりにくく調査コストが高い。
- 開発者: クロスプラットフォーム検証で macOS だけ落ちる挙動差。Chromium での動作確認をすり抜ける。

## Fix / Workaround

- 該当ボタンに `onMouseDown={(e) => e.preventDefault()}` を付与し、input から focus が外れる前にデフォルトの focus 移動を抑止 → `onClick` が input の `onBlur` より先に確定するようにする（恒久対応・WKWebView 差の標準回避策）。
- 適用箇所: WikiTag パネル（2026-04-26 セッション）。同型の「autoFocus input + 同一パネル内アクションボタン」構成は同じ対策が必要。
- 詳細: git 履歴 `git show <rev>:.claude/archive/2026-04-22-ios-refactor.md` / WikiTag 関連プラン。

## References

- 関連ファイル: WikiTag パネル系コンポーネント（`autoFocus` input + アクションボタン構成）
- 関連 plan（削除済み・git 履歴）: `.claude/archive/2026-04-22-ios-refactor.md` 周辺
- 関連 HISTORY: `.claude/HISTORY-archive.md` 2026-04-26 セッション

## Lessons Learned

- macOS WebKit / WKWebView は `<button>` クリックで focus を移さない。**`autoFocus` input と同一パネル内のボタン**を作るときは、ボタンに `onMouseDown` で `preventDefault()` を入れて onBlur → onClick の順序を保証する。
- Tauri/Electron で「Chromium では動くが macOS（WebView）で効かないボタン」を見たら、まず focus/blur の発火順を疑う。`document.activeElement` をログして検証。
- frontend-react-designer の Anti-Pattern「IME 破壊」と同じく、**フォーカス制御はプラットフォーム差が出る**領域。新規フォームパネル作成時のチェックポイント。
- 検索キーワード: `onMouseDown` `preventDefault` autoFocus blur button macOS WebKit WKWebView focus-shift
