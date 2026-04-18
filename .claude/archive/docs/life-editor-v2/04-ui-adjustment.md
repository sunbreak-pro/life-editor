# Step 4: UI 調整

> 前提: `01-terminal.md`〜`03-claude-setup.md` が完了していること

## 目的

life-editor v2 としてのブランディングと UX を整える。
カレンダーをデフォルト画面にし、ターミナルと Claude の状態を常に視認できるようにする。

---

## 方針

既存の UI を壊さず、最小限の調整で life-editor v2 としての体験を作る。
大きなリデザインはしない。

---

## 調整項目

### 1. デフォルト画面をカレンダーに変更

現在の `App.tsx`:

```typescript
const [activeSection, setActiveSection] = useState<SectionId>("tasks");
```

これを `"tasks"` のままにするか `"calendar"` に変更するかは、SectionId の設計次第。

**方針**: 既存の Tasks セクション内にカレンダーが含まれている（`TasksLayout` 内の `CalendarView`）ため、大きな変更は不要。ただし、アプリ起動時にカレンダービューが最初に目に入る状態にする。

### 2. LeftSidebar の調整

現在のメニュー項目:

```
Tasks / Memo / Work / Analytics / Trash / Settings / Tips
```

**変更方針**:

- 全項目をそのまま残す（既存機能保持の方針に従う）
- 順序を調整してカレンダー/タスクが上部に来るようにする（必要であれば）
- アプリタイトル「Life Editor」→「Life Editor」に変更

### 3. StatusBar の追加

画面下部に StatusBar を追加し、以下の情報を常時表示する:

- **ターミナル状態**: セッション数、開閉トグル
- **Claude 状態**: idle / thinking / generating / tool_use（Step 3 の検知結果）
- **MCP Server 状態**: 接続中 / 未接続

StatusBar は全セクション共通で表示される。

### 4. アプリ名・ブランディング変更

| 変更箇所                          | Before        | After                 |
| --------------------------------- | ------------- | --------------------- |
| `package.json` の `name`          | `life-editor` | `life-editor`         |
| `package.json` の `productName`   | `Life Editor` | `Life Editor`         |
| LeftSidebar のタイトル            | `Life Editor` | `Life Editor`         |
| ウィンドウタイトル                | `Life Editor` | `Life Editor`         |
| `electron-builder.yml` の `appId` | 現在の値      | `com.life-editor.app` |

**注意**: アプリ名変更は `userData` パスに影響する可能性がある。
Electron の `app.name` が変わると `app.getPath("userData")` のパスが変わり、既存の DB ファイルにアクセスできなくなる。
これを避けるため、DB パスをハードコードするか、マイグレーションスクリプトを用意する。

### 5. ターミナル開閉の UX

TerminalPanel の開閉方法:

- **キーボードショートカット**: Ctrl+`` ` `` （VSCode と同じ）
- **StatusBar のトグルボタン**: クリックで開閉
- **状態の永続化**: localStorage に開閉状態を保存

---

## 参照すべき既存コード

| ファイル                                         | 参照ポイント                           |
| ------------------------------------------------ | -------------------------------------- |
| `frontend/src/App.tsx`                           | activeSection の初期値、レイアウト構成 |
| `frontend/src/components/Layout/LeftSidebar.tsx` | メニュー項目の定義、タイトル表示       |
| `frontend/src/types/taskTree.ts`                 | SectionId 型の定義                     |
| `package.json`（ルート）                         | アプリ名、productName                  |
| `electron-builder.yml`                           | appId、ビルド設定                      |
| `electron/main.ts`                               | ウィンドウタイトルの設定               |
| `frontend/src/constants/storageKeys.ts`          | localStorage キーの管理                |

---

## 注意事項

### userData パスの変更リスク

Electron はアプリ名から `userData` パス（`~/Library/Application Support/{appName}/`）を決定する。
アプリ名を変更すると:

- 既存の `life-editor.db` が見つからなくなる
- 設定やログが初期化される

**Phase A の方針: 内部の app name は `life-editor` のまま変更しない。** UI 表示のみ「Life Editor」にする。

具体的には:

- `package.json` の `name` は `life-editor` のまま
- LeftSidebar のタイトルテキストのみ変更
- ウィンドウタイトルのみ変更
- `electron-builder.yml` の `appId` は変更しない

これにより、userData パス（`~/Library/Application Support/life-editor/`）が維持され、既存 DB やログが失われるリスクがゼロになる。本格的なリネームは Phase B 以降で検討する。

### 既存ショートカットとの競合

ターミナル開閉ショートカット（Ctrl+`` ` ``）が既存のショートカットと競合しないか確認する。
Life Editor の既存ショートカット:

- j/k: カレンダー前後移動
- t: 今日
- m: 月/週切替
- Cmd+Z/Shift+Cmd+Z: Undo/Redo

---

## 完了条件

- [ ] アプリ起動時にカレンダーが最初に表示される
- [ ] LeftSidebar のタイトルが「Life Editor」になっている
- [ ] StatusBar が画面下部に表示され、ターミナル状態と Claude 状態が見える
- [ ] Ctrl+`` ` `` でターミナルの開閉ができる
- [ ] `npm run build` でビルドが成功する
- [ ] 既存機能（Work、Analytics、Tips 含む）が正常動作する
- [ ] 既存の DB データ（タスク、メモ等）が失われない
