# UI States — life-editor 4 状態モデル + IME 安全

> Loading / Empty / Error / Idle の 4 状態を網羅し、状態遷移と IME / DnD / 楽観的更新の落とし穴を記述する。

## §1 4 状態モデル

```
Loading  → 初回データ取得中、まだ表示するものが何もない
Empty    → 取得成功、ただし結果ゼロ件 (Tasks 0, Notes 0 等)
Error    → 取得失敗 / IPC 失敗 / 例外
Idle     → データあり、通常表示
```

Claude は Idle だけを書きがち。**4 状態すべてを設計してから書き始める**。

### 状態ごとの推奨表現

| 状態    | 表現                                                                            | NG                                               |
| ------- | ------------------------------------------------------------------------------- | ------------------------------------------------ |
| Loading | 初回のみ `skeleton` または控えめ spinner。再フェッチは Toast の stale indicator | スピナーで全画面ブロック / chrome の上にも被せる |
| Empty   | コンテキストに合った 1 行 + 次の操作 (CTA)                                      | "No data" だけの素気ない表示                     |
| Error   | 原因 1 行 + リトライ操作 + 詳細ログは consol e のみ                             | スタックトレースを画面に出す                     |
| Idle    | データ + ホバー / focus / DnD のフィードバック                                  | 状態フィードバック無しの static な見た目         |

### 例: Tasks リストの 4 状態

```tsx
function TaskList({ tasks, status, error, onRetry }: Props) {
  if (status === "loading" && tasks.length === 0) {
    return <TaskListSkeleton />; // 初回のみ
  }
  if (status === "error") {
    return (
      <ErrorPanel
        message={error?.message ?? t("tasks.error.generic")}
        onRetry={onRetry}
      />
    );
  }
  if (tasks.length === 0) {
    return (
      <EmptyState
        title={t("tasks.empty.title")}
        cta={t("tasks.empty.create")}
        onCta={onCreate}
      />
    );
  }
  return (
    <ul>
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} />
      ))}
    </ul>
  );
}
```

再フェッチ時 (`tasks.length > 0` で `status === "loading"`) は **既存リストを表示したまま** Toast / 上端の細い progress bar で示す。

## §2 楽観的更新と UndoRedo の連携

life-editor は `UndoRedoProvider` を持つ。書き込み系 UI (チェック / リネーム / 削除 / DnD) は:

1. UI を即座に更新 (楽観的)
2. `getDataService()` 経由で永続化
3. 失敗したら revert + Toast で告知
4. 成功時は UndoRedo に push

**`useState` ベースの楽観 UI で `setState` 後に await すると、コンポーネントがアンマウントされた際に setState 警告が出る**。`useTransition` または `signal.aborted` チェックを使う。

## §3 IME (日本語入力) 安全

life-editor は日本語ファーストで IME 中に submit が走ると致命的。以下を必須とする:

```tsx
function NameInput({ onSubmit }: Props) {
  const [value, setValue] = useState("");
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        if (e.nativeEvent.isComposing) return; // ← 必須
        onSubmit(value);
      }}
    />
  );
}
```

**チェックリスト**:

- [ ] `onKeyDown` の Enter / Escape ハンドラで `e.nativeEvent.isComposing` を確認
- [ ] `onChange` 時の即時 fire (例: search-as-you-type) は OK だが、debounce 200ms 以上推奨
- [ ] Tiptap (`@tiptap/react`) は内部で composition 対応済み。独自 keymap を足すときだけ要注意
- [ ] textarea の Cmd+Enter による submit も同じく `isComposing` ガード

**既知 issue 参照**: 過去に IME 起因のバグが起きていれば `.claude/docs/known-issues/INDEX.md` を grep（Active なプロダクトバグは `gh issue list -R sunbreak-pro/life-editor --label type:bug` も併用）。

## §4 DnD (`@dnd-kit`) 状態

`moveNode` (並び替え) と `moveNodeInto` (階層移動) は別操作 (`.claude/rules/frontend.md` Gotchas / DnD)。DnD UI を作る際:

- ドラッグ中は `aria-grabbed` / `aria-dropeffect` を反映 (`@dnd-kit/accessibility` が一部担当)
- ドラッグ source は `opacity-30` 程度で消失予感を与える (これは透明度禁止の例外、§5 ホバー / 状態表現に該当)
- ドロップターゲットは `ring-2 ring-lumen-accent` で示す
- キーボード操作 (Space で持つ / 矢印で移動 / Enter で drop) を `KeyboardSensor` で有効化

## §5 フォームの状態

| 状態       | 表示                                                                |
| ---------- | ------------------------------------------------------------------- |
| Pristine   | placeholder のみ                                                    |
| Touched    | バリデーションを始める (まだエラー出さなくても OK)                  |
| Invalid    | `aria-invalid="true"` + `aria-describedby` でエラー文言 ID を指す   |
| Submitting | submit ボタンは `disabled` + `aria-busy="true"`、二重送信を絶対防止 |
| Success    | Toast 表示 + フォームをリセット or 編集モード解除                   |

submit ボタンの disabled 時もフォーカス可能にし、なぜ disabled かを `title` / `aria-describedby` で伝える。

## §6 状態の組み合わせバグ (典型)

| 症状                                       | 原因                                                                                           |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| リスト fetch 中にスケルトン → 空にチラつく | `tasks.length === 0` 判定を先に置いている。Loading 判定を先に書く                              |
| Empty が一瞬出てから Idle に               | 楽観的に fetch 前に空配列を表示。初期値を `null` にし `if (data == null)` でローディングに分岐 |
| Error 表示後リトライしてもスピナー出ない   | `status` を error のままに保持。リトライ時は `loading` に戻す                                  |
| IME 中の Enter で submit                   | `e.nativeEvent.isComposing` 未チェック (§3)                                                    |
| DnD 中に list が再 render され drop 失敗   | DnD 中は外部 fetch を pause、または `useDeferredValue` で抑制                                  |
