# iOS 追加機能要件

> ユーザー note「iOS追加機能要件」の SSOT 化。Mobile (iOS Tauri) 専用に追加で必要な機能要件を記録する。
> 元 note: life-editor → ノート → iOS追加機能要件（2026-04-22 取得）
> 関連: [`vision/mobile-porting.md`](../vision/mobile-porting.md) / [`vision/mobile-data-parity.md`](../vision/mobile-data-parity.md) / CLAUDE.md §2 Platform / §6.2 Provider 順序

iOS は Desktop の **Consumption + Quick capture** 役割（CLAUDE.md §2）に位置付けられているが、
実機運用で「Desktop と同等まで揃えたい挙動」がいくつか抽出されたため、機能要件として固定する。
本ファイルは Tier 1-3 の縦割りに収まらない **iOS 限定の上乗せ要件** を扱い、各項目は対応する Tier 機能（UndoRedo / Cloud Sync / Layout 等）に依存する。

---

## Section: Global

App 全体（Mobile）で横断的に適用される UI / 同期挙動の追加要件。
原則として「Desktop で既に動いている挙動を Mobile 側にも揃える」ことが主眼。

---

### G-1: Mobile Header に Undo / Redo ボタンを配置

**Status**: ✓ Done（2026-04-24 実装 — MobileLayout グローバルヘッダーに UndoRedoButtons 常設 + TipTap editor history 連携）
**Owner Provider/Module**: `frontend/src/components/Layout/MobileLayout.tsx` / `frontend/src/components/shared/UndoRedo/UndoRedoButtons.tsx` / `frontend/src/components/shared/UndoRedo/sectionDomains.ts`
**Depends on Feature**: UndoRedo（Tier 2 — `tier-2-supporting.md`）
**Platform**: iOS only

#### Purpose

Desktop の `TitleBar` に置かれている Undo / Redo ボタンと同等のものを、Mobile 画面のヘッダー右上にも常設する。
キーボードショートカット（Cmd+Z 等）が事実上使えない iOS で、UndoRedoProvider を機能として活かすには UI 経路が必須。

#### Boundary

- やる:
  - `Mobile*View.tsx`（Schedule / Memo / Note / Tasks / Materials / Work / Settings 等）の共通ヘッダー右上に Undo / Redo ボタンを表示
  - 既存 `UndoRedoButtons` コンポーネントを再利用（タッチ向けに最小タップ領域 44px は満たす）
  - ボタンの enabled / disabled は UndoRedoProvider の `canUndo` / `canRedo` に追従
- やらない:
  - 新たな履歴永続化（UndoRedo Tier 2 と同じくセッション内のみ — `tier-2-supporting.md` AC5）
  - Undo / Redo 以外のヘッダーアクション追加（本要件のスコープ外）

#### Acceptance Criteria

- [x] AC1: Mobile のグローバルヘッダー右上に Undo / Redo の 2 ボタンが表示される
- [x] AC2: 各ボタンは現在アクティブなドメインの履歴に応じて enabled / disabled が切り替わる
- [x] AC3: タップで Desktop の Cmd+Z / Cmd+Shift+Z と同じドメインスタックの 1 ステップを取り消し / やり直しできる（TipTap editor 内編集はエディタ内履歴、それ以外はドメインスタック）

#### Dependencies

- 他機能: UndoRedo（`UndoRedoProvider`）
- 既存資産: `frontend/src/components/shared/UndoRedo/UndoRedoButtons.tsx` / `frontend/src/utils/undoRedo/`
- 新規追加: `sectionDomains.ts` で Desktop TitleBar と共有、`UndoRedoContext` に `setActiveEditor` / `getActiveEditor` 追加、`RichTextEditor` が onFocus で自身を登録

---

### G-2: Cloud Sync をモバイル回線（4G/5G）でも実行可能にする

**Status**: ✓ Done（2026-04-24 実機確認。ユーザー運用で Wi-Fi / Cellular いずれでも同期成功）
**Owner Provider/Module**: `SyncProvider` / `src-tauri/tauri.conf.json` / iOS 側 `Info.plist`（`NSAppTransportSecurity` 等）
**Depends on Feature**: Cloud Sync（Tier 1 — `tier-1-core.md`）
**Platform**: iOS only

#### Purpose

実機で Wi-Fi を切ってモバイル回線（4G/5G）に切り替えると Cloud Sync が成立しない（と疑われる）症状を解消する。
`vision/mobile-porting.md` の「**Cloud Sync で常時接続する**」という前提を満たすには、外出先での 4G/5G 同期が必須。

#### Boundary

- やる:
  - 回線種別（Wi-Fi / Cellular）を問わず `sync_trigger` が成功すること
  - Cellular 回線で同期が失敗する場合は、原因がコード側か iOS 側設定（ATS / バックグラウンド許可 / Tauri allowlist）かを切り分け
  - 必要なら Tauri / Info.plist 側の network 関連設定（HTTP 通信許可、許可ドメイン、background fetch 等）を更新
- やらない:
  - 「モバイル回線で同期しない」UI トグルの追加（明示要件外）
  - リアルタイム push（SSE / WebSocket）化 — Cloud Sync の Future Enhancement 側で扱う

#### Acceptance Criteria

- [ ] AC1: iPhone 実機で Wi-Fi をオフ → 4G/5G のみの状態で `sync_trigger` を実行し、push / pull が成功する
- [ ] AC2: 回線種別による失敗パターン（タイムアウト / ATS ブロック / 認証失敗）を 1 つでも踏んだ場合は再現手順と対処を `docs/known-issues/` に記録する
- [ ] AC3: Cellular 経由での同期成功後、Wi-Fi 環境と同じく `sync_get_status` の `last_synced_at` が更新される

#### Dependencies

- 他機能: Cloud Sync（`SyncProvider` / `src-tauri/src/sync/*`）
- 外部: Cloudflare Workers + D1（HTTPS 経由のため ATS 標準設定で通る想定）
- プラットフォーム: iOS Info.plist / Tauri allowlist

#### 調査メモ

- 現コードベースに `wifi` / `cellular` / `networkType` 等の文字列は存在しない（grep 結果より）→ コード側で能動的なブロックはしていない
- 最初の切り分けは「実機 4G/5G で `sync_trigger` の HTTP レスポンスを Tauri 側ログで観察」

---

### G-3: 左上 LifeEditor タイトル位置にハンバーガーメニュー → 左ドロワー

**Status**: ✓ Done（2026-04-24 実装 — Phase 2.3-Redo で Desktop sidebar を drawer に直接埋込、main 領域は DailyView/NotesView エディタ）
**Owner Provider/Module**: `frontend/src/components/Mobile/shared/MobileLeftDrawer.tsx`（新規想定）/ 既存 `frontend/src/components/Layout/RightSidebar.tsx`（参照元）
**Depends on Feature**: 各セクションの右サイドバー（RightSidebar 経由のセクション固有 UI）
**Platform**: iOS only

#### Purpose

Mobile では Desktop の RightSidebar が常時表示できない。
左上の「Life Editor」タイトル部分にハンバーガーアイコンを置き、タップで左から Drawer をスライドインさせ、
そこに Desktop の RightSidebar と同じ内容（セクションごとのフィルタ・補助 UI）を表示する。

#### Boundary

- やる:
  - Mobile 画面ヘッダー左端の「Life Editor」表示にハンバーガーアイコンを追加（タップ可能領域は 44px 以上）
  - タップで左 → 右にスライドする Drawer を表示
  - Drawer の中身は **Desktop の RightSidebar と同じ内容 / 同じコンポーネント**（セクションごとに `RightSidebarContext` から portal される内容）
  - Drawer 外タップ / 左スワイプで閉じる
- やらない:
  - Drawer 用に新規メニューを設計する（あくまで RightSidebar 内容の流用）
  - Mobile 省略 Provider 依存の UI（FileExplorer / CalendarTags / WikiTag / ShortcutConfig 等）は Optional hook で `null` ガードして除外（CLAUDE.md §6.3）

#### Acceptance Criteria

- [x] AC1: Mobile の各画面ヘッダー左端「Life Editor」横にハンバーガーアイコンが表示される
- [x] AC2: ハンバーガータップで左から Drawer がスライドインし、Drawer 内に現在のセクションの RightSidebar 内容が表示される（Materials → DailySidebar/MaterialsSidebar、Work → WorkSidebarInfo）
- [x] AC3: Drawer 外タップ または Drawer 左端から左方向のスワイプで Drawer が閉じる
- [x] AC4: Mobile 省略 Provider に依存する UI は表示されない（WorkSidebarInfo の Audio セクションは null ガードで除外）

#### Dependencies

- 既存資産: `frontend/src/components/Layout/RightSidebar.tsx` / `frontend/src/context/RightSidebarContext.ts` / `frontend/src/components/{Schedule,Tasks,Materials,Work,Settings}/*Sidebar*.tsx`
- 他機能: 各セクションの sidebar content（DailySidebar / FileExplorerSidebar / MaterialsSidebar / ScheduleSidebarContent / WorkSidebarInfo 等）
- 設計制約: CLAUDE.md §6.3 Optional hook（Mobile 省略 Provider 必須）

---

### G-4: メインコンテンツ（画面中央）を Desktop と近い構成にする

**Status**: △ 部分着手（`Mobile*View.tsx` は存在するが Desktop との差分が大きい箇所あり — 詳細は per-section 要件として別途追加予定）
**Owner Provider/Module**: `frontend/src/components/Mobile/Mobile*View.tsx`
**Depends on Feature**: Tasks / Schedule / Notes / Memo / Materials / Work（Tier 1-2 一式）
**Platform**: iOS only

#### Purpose

Mobile 専用の独自レイアウトに分岐させすぎず、**Desktop で慣れた情報配置・操作を Mobile でも可能な限り維持** する。
これにより Desktop ↔ iOS の認知コストを下げ、Cloud Sync で見ているデータが「同じものに見える」状態を保つ。

#### Boundary

- やる:
  - 各 `Mobile*View.tsx` のメインコンテンツを Desktop 対応セクションと同じ情報・並び・グルーピングに揃える
  - タッチ最適化（タップ領域 44px / スクロール慣性 / 縦長レイアウト）は許容
  - Desktop と異なる挙動が必要な場合は本ファイルに per-section 要件として別途追加
- やらない:
  - Mobile 専用の独自情報レイアウト（Card 化のみ等の極端な変形）
  - Mobile 省略 Provider 依存の UI（共有コンポーネント側で `null` ガード）

#### Acceptance Criteria

- [ ] AC1: 各 Mobile セクションのメインコンテンツの「項目の種類・並び順・グルーピング」が Desktop 対応セクションと一致する
- [ ] AC2: Desktop と挙動が異なる箇所はすべて本ファイルに per-section 要件として記載されている（暗黙の差分ゼロ）
- [ ] AC3: Mobile 省略 Provider に依存する UI 要素は Optional hook ガードで除外され、画面エラーを起こさない

#### Dependencies

- 他機能: 全 Tier 1 / Tier 2 セクション（Tasks / Schedule / Notes / Memo / Materials / Work / Settings）
- 設計制約: CLAUDE.md §6.3 / `vision/mobile-data-parity.md`

#### Notes

- 本要件は方針 / ゲートとして機能する。具体的な per-section 差分（例: Schedule の DayFlow を Mobile でも出す等）は元 note の続き（Schedule / Tasks / Notes 等のセクション）から順次追記する想定

---

### G-5: 左 → 右スワイプで「一つ前の画面」に戻る

**Status**: ✓ Done（2026-04-24 実装 — `useSectionHistory` + `useEdgeSwipeBack` 左端 24px 起点）
**Owner Provider/Module**: `frontend/src/components/Mobile/shared/`（新規 hook / wrapper 想定）/ App.tsx の `activeSection` ナビゲーション履歴
**Depends on Feature**: Section Routing（CLAUDE.md §3.3 — `App.tsx` の `activeSection`）
**Platform**: iOS only

#### Purpose

iOS ネイティブアプリの「画面左端から右へのスワイプで戻る」ジェスチャー（UINavigationController の interactive pop）に倣い、
Life Editor Mobile でも 1 つ前の画面に戻れるようにする。
現状は React Router を使わず `App.tsx` の `activeSection` で切り替えているため、ナビゲーション履歴を別途持つ必要がある。

#### Boundary

- やる:
  - 直近の `activeSection` 遷移履歴をスタックで保持
  - 画面左端（左 16-24px 程度）から右への横スワイプを検知して 1 つ前の `activeSection` に戻す
  - 履歴が空のときはジェスチャーを無効化（または視覚的に効かないことを示す）
- やらない:
  - フルスクリーン横スワイプ全般（左端起点に限定。中央スワイプは DnD / カルーセル等と衝突するため）
  - Drawer 開閉 / DnD / TipTap 編集中スワイプとの衝突許容（衝突は AC3 で禁止）
  - Desktop での同等ジェスチャー実装（iOS only）

#### Acceptance Criteria

- [x] AC1: 画面左端から右方向にスワイプすると、直前の `activeSection` に戻る
- [x] AC2: ナビゲーション履歴が空のときはジェスチャーが無効化される
- [x] AC3: Drawer 開閉中は無効化、ProseMirror 編集領域起点は無効化（`data-no-edge-swipe` でもガード可能）

#### Dependencies

- 他機能: Section Routing（`App.tsx` activeSection 切替）/ G-3 Drawer ジェスチャー（衝突回避）
- 既存資産: なし（新規）

---

## Section: Materials

Mobile の `materials` タブ（Daily / Notes サブタブ）に関する追加要件。
元 note 原文（2026-04-23 取得）:

- アイテムを右から左にスライドすることでアイテムがスライドし、編集(名前変更など)、ピン、削除ボタンを表示させる(Appleの標準メモアプリを踏襲)
- バブルツールバーにスラッシュコマンドの選択ができるようにする
- 何もないテキストのところにカーソルを合わせるとスラッシュコマンドが表示されるようにする
- タブが追加されているとタイトルが見えなくなっている。
- タイトル名ではなく本文内の一文目がプレビューのタイトル名になっている為、本文コンテンツのヘッダータイトル部分をプレビュー画面で表示されるアイテム名にする。

---

### M-1: 一覧行の右→左スワイプで「編集 / ピン / 削除」ボタン表示（Apple メモアプリ互換）

**Status**: × 未着手
**Owner Provider/Module**: `frontend/src/components/Mobile/shared/useRowSwipeActions.tsx`（新規想定）/ `MobileNoteTreeItem.tsx` / `MobileDailyView.tsx` / `MobileMaterialsView.tsx`
**Depends on Feature**: Notes / Daily（Tier 1）
**Platform**: iOS only

#### Purpose

Apple 標準メモアプリの UX を踏襲し、Notes / Daily 一覧で行を右から左にスワイプすると「名前変更 / ピン / 削除」のアクションボタンが背面からスライド表示されるようにする。Long Press のアクションシート経路と併存し、片手操作で主要アクションに到達可能にする。

#### Boundary

- やる:
  - Notes 一覧 (`MobileNoteTreeItem`) と Daily 一覧 (`MobileDailyView`) の各行に右→左スワイプハンドラを実装
  - 参考: 既存 `MobileScheduleView.tsx` の左スワイプ削除（threshold 80px、背景 reveal）
  - アクション: rename（インラインタイトル編集 or モーダル呼び出し）/ pin（トグル）/ delete（ソフトデリート）
  - Long Press (500ms) の ActionSheet と衝突しないようタッチ分岐
- やらない:
  - スワイプで即時削除（必ずボタンタップを介在させる）
  - 左→右方向のスワイプアクション（G-5 Edge Swipe と競合するため）

#### Acceptance Criteria

- [ ] AC1: Notes / Daily 一覧の行を右→左にスワイプすると、edit / pin / delete ボタンが背面から表示される
- [ ] AC2: 他の行をスワイプ or タップすると前の行のスワイプ状態は閉じる
- [ ] AC3: 削除はソフトデリート（`is_deleted` / `deleted_at`）で、Trash から復元可能
- [ ] AC4: pin はトグル、再タップで解除
- [ ] AC5: Long Press → ActionSheet の既存導線と衝突しない（touchmove で長押しはキャンセル）

#### Dependencies

- 既存資産: `MobileScheduleView.tsx` スワイプパターン / `MobileActionSheet` / ソフトデリート機構（CLAUDE.md §4.4）
- 新規: `frontend/src/components/Mobile/shared/useRowSwipeActions.tsx`

---

### M-2: バブルツールバーにスラッシュコマンド呼び出しを追加

**Status**: × 未着手（Desktop にも未実装のため共通基盤整備込み）
**Owner Provider/Module**: `frontend/src/components/Notes/extensions/SlashCommand.ts`（新規想定）/ 既存 TipTap BubbleMenu 設定
**Depends on Feature**: Notes（Tier 1 — リッチテキスト TipTap）
**Platform**: Desktop / iOS 共通（Mobile 要件起点で Desktop も同時導入）

#### Purpose

iOS では `/` キーの入力が Desktop ほど直感的ではないため、選択中テキストのバブルツールバーから「スラッシュコマンド」（見出し・リスト・チェックリスト・区切り線など）を呼び出せるようにする。Desktop 版も同基盤で恩恵を受ける。

#### Boundary

- やる:
  - TipTap BubbleMenu に「+ command」ボタン（または `/` アイコン）を追加
  - タップでスラッシュコマンドのコマンドパレット / メニューをポップオーバー表示
  - コマンド: heading 1-3 / bullet list / ordered list / task list / code block / blockquote / divider / image
- やらない:
  - 新規ブロックタイプ（callout / toggle 等）の追加（Notes 側の別要件）
  - Desktop 向けキーバインド変更（既存のキー入力は従来通り）

#### Acceptance Criteria

- [ ] AC1: BubbleMenu に「+ command」ボタンが表示される
- [ ] AC2: タップで 8 種のブロック変換コマンドがメニュー表示され、選択でカーソル位置のノードが変換される
- [ ] AC3: i18n（ja / en）でコマンドラベルが切り替わる
- [ ] AC4: Desktop でも同一機能が動作する

#### Dependencies

- 外部: `@tiptap/extension-bubble-menu` / `@tiptap/suggestion`（要導入確認）
- 他機能: M-3（空行ヒント）と同一 extension 基盤

---

### M-3: 空行にカーソルを合わせるとスラッシュコマンドのヒントを表示

**Status**: × 未着手
**Owner Provider/Module**: `frontend/src/components/Notes/extensions/EmptyLineHint.ts`（新規想定）/ 既存 TipTap FloatingMenu
**Depends on Feature**: Notes（Tier 1）/ M-2 との同一基盤
**Platform**: Desktop / iOS 共通

#### Purpose

「何もないテキストのところ」＝段落内容が空の行にカーソルが当たった際、そこから即座にスラッシュコマンド起動できるヒント UI を表示する。入力開始の迷いを減らす。

#### Boundary

- やる:
  - 空の paragraph ノードにカーソルがある時のみ Floating hint を表示
  - タップでスラッシュコマンドメニューを開く（M-2 と同じコマンド集）
  - `/` 入力でも同じメニューが開くキーバインドを追加
- やらない:
  - 非空ノードでのヒント表示（邪魔になるため）
  - IME 入力中のヒント表示（`e.nativeEvent.isComposing` ガード）

#### Acceptance Criteria

- [ ] AC1: 空行にフォーカスがあるときのみヒントが表示される
- [ ] AC2: ヒントタップ または `/` 入力でスラッシュコマンドメニューが開く
- [ ] AC3: IME 変換中はヒントが表示されない（CLAUDE.md §6.6 IME 対応）

#### Dependencies

- 他機能: M-2（同じ extension 基盤）
- 既存資産: TipTap FloatingMenu

---

### M-4: Materials サブタブ追加時にタイトルが消えるバグ修正

**Status**: × 未着手（バグ）
**Owner Provider/Module**: `frontend/src/components/Mobile/MobileMaterialsView.tsx`
**Depends on Feature**: Materials タブ（Daily / Notes）
**Platform**: iOS only

#### Purpose

Materials 画面で Daily / Notes のサブタブが存在する際、ヘッダータイトル（セクション名）がレイアウトの overflow / flex 折り返しで見切れるバグを解消する。

#### Boundary

- やる:
  - サブタブ表示時もタイトルが欠けない flex レイアウト修正
  - `min-w-0` / `flex-shrink` / `truncate` を適切に適用
  - 長いタイトル（日本語タイトル等）でも収まる挙動
- やらない:
  - タイトル自体の表示仕様変更（M-5 は別要件）

#### Acceptance Criteria

- [ ] AC1: Materials の Daily / Notes いずれのサブタブ選択時も、タイトルがレイアウト内で見える
- [ ] AC2: タイトルが長すぎる場合は truncate されるが、先頭文字は常に表示される

#### Dependencies

- 既存資産: `MobileMaterialsView.tsx` 現行レイアウト

---

### M-5: プレビュータイトルを本文の最初の heading から導出

**Status**: ✓ Done（2026-04-24 実装 — `utils/tiptapText.ts` の `extractFirstHeading` + `NoteTreeNode` 表示切替で Desktop/Mobile 共通反映）
**Owner Provider/Module**: `frontend/src/utils/tiptapText.ts`（既存）/ Notes / Materials 一覧表示コンポーネント
**Depends on Feature**: Notes（Tier 1）/ Materials 一覧
**Platform**: iOS only（Desktop 波及は Phase 4 で判断）

#### Purpose

現状のプレビュータイトル導出ロジックは `note.title || "Untitled"`。しかし本文冒頭に heading（H1/H2/H3）を書いてタイトル代わりにしているケースが多く、一覧表示で `note.title` が空だと「Untitled」や本文 1 行目の断片が表示されて識別性が低い。本文の最初の heading テキストを優先してプレビュータイトルに使う。

#### Boundary

- やる:
  - `tiptapText.ts` に `extractFirstHeading(contentJson: string): string | null` を追加
  - Notes / Materials 一覧のタイトル導出を「最初の heading → `note.title` → "Untitled"」の順にフォールバック
  - Mobile の MaterialsView / Notes 一覧で優先適用
- やらない:
  - `note.title` カラム自体の自動書き換え（ユーザーが明示した title は残す）
  - 本文 1 行目（heading 以外）のフォールバック（Apple メモ風は要件外）

#### Acceptance Criteria

- [ ] AC1: 本文先頭に heading があるノートは、その heading テキストが一覧プレビュータイトルに表示される
- [ ] AC2: `note.title` 明示設定がある場合でも heading を優先（= heading が SSOT）
- [ ] AC3: heading も title も空なら "Untitled"
- [ ] AC4: Desktop の同等表示箇所に波及させるかは Phase 4 で個別判断

#### Dependencies

- 既存資産: `frontend/src/utils/tiptapText.ts` / `MaterialsSidebar.tsx` / Notes 一覧系コンポーネント

---

## Section: Calendar

Mobile `schedule` タブの Calendar ビューに関する追加要件。
元 note 原文:

- 横にスライドで月の Calendar grid がスライドされ先月、来月のものに移動可能
- フィルタ機能、並び替え機能実装
- add item のとき、Events / Tasks / Routine / Notes / Daily の 5 つの role を iOS でも選択可能にできるようにする

---

### C-1: 月カレンダーグリッドの横スワイプ（前月 / 翌月）

**Status**: ✓ Done（2026-04-24 実装 — `MobileCalendarView` 月グリッドに touch handler、60px threshold）
**Owner Provider/Module**: `frontend/src/components/Mobile/MobileCalendarView.tsx`
**Depends on Feature**: Schedule / Calendar（Tier 1）
**Platform**: iOS only

#### Purpose

月表示のカレンダーグリッドを左右スワイプで前月 / 翌月に切り替え可能にする。Chevron ボタンと併存させ、両手段を提供する。参考実装は既存 `MobileCalendarStrip.tsx`（週単位で実装済）。

#### Boundary

- やる:
  - 月グリッドに `onTouchStart/Move/End` を実装（threshold 50-60px、translateX 200-250ms アニメーション）
  - 既存 ChevronLeft / ChevronRight ボタンは残す
  - スワイプ中の視覚フィードバック（グリッドが指追従）
- やらない:
  - 3D transform や高度なパララックス演出
  - 週ビュー / 日ビューへの切替をスワイプに割当（既存ボタン経由）

#### Acceptance Criteria

- [ ] AC1: 月グリッドを左スワイプで翌月、右スワイプで前月に切り替わる
- [ ] AC2: スワイプ中はグリッドが指に追従する
- [ ] AC3: Chevron ボタンでも従来通り月切替ができる
- [ ] AC4: G-5 Edge Swipe（左端 16-24px 起点）と衝突しない（月スワイプは中央域で動作）

#### Dependencies

- 既存資産: `MobileCalendarStrip.tsx`（週スワイプの参考実装）

---

### C-2: フィルタ・並び替え機能

**Status**: × 未着手
**Owner Provider/Module**: `frontend/src/components/Mobile/MobileCalendarView.tsx` / G-3 Drawer 内 or 新規 FilterSheet
**Depends on Feature**: Schedule（Tier 1）
**Platform**: iOS only

#### Purpose

Calendar 上の表示項目を role（Event / Task / Routine / Note / Daily）・タグで絞り込み、並び順（時刻順 / 優先度 / 作成日時）を切り替え可能にする。

#### Boundary

- やる:
  - フィルタ: role 多選択（default: 全 ON）、タグ絞り込み（Optional hook で null ガード）
  - 並び替え: 時刻順（default）/ 優先度 / 作成日時
  - UI は G-3 の左ドロワー内の Sidebar content として提供するのを第一候補、難しければ BottomSheet
  - セッション内保持（localStorage は任意、衝突リスクがあれば不採用）
- やらない:
  - Desktop 版の独自フィルタ UI 改変（Desktop 側は既存ロジック流用）
  - キーワード検索（別要件）

#### Acceptance Criteria

- [ ] AC1: 5 role のフィルタを多選択でき、Calendar と DayFlow の表示が追従する
- [ ] AC2: 並び順切替で DayFlow の並びが変わる（Calendar は時刻固定のため並びは DayFlow 側で反映）
- [ ] AC3: WikiTag フィルタは Mobile 省略 Provider 対応のため Optional hook で null ガードし、未利用環境ではフィルタ UI を非表示

#### Dependencies

- 他機能: G-3 Drawer / Schedule Provider
- 既存資産: Desktop 側の既存フィルタロジックがあれば流用

---

### C-3: add item で 5 role（Events / Tasks / Routine / Notes / Daily）を選択

**Status**: △ Desktop 実装済 / Mobile 未着手（2026-04-24 — Desktop `CreateItemPopover` に Routine 追加、Mobile `MobileScheduleItemForm` は別 PR 継続）
**Owner Provider/Module**: `frontend/src/components/Tasks/Schedule/Calendar/CreateItemPopover.tsx`（Desktop, 既存 4 role）/ `frontend/src/components/Mobile/MobileScheduleItemForm.tsx`
**Depends on Feature**: Schedule / Routine / Notes / Daily（Tier 1）
**Platform**: Desktop / iOS 共通（Desktop も 4 → 5 role に拡張）

#### Purpose

Schedule への add item 時、Desktop は現在 4 role（Task / Note / Daily / Event）対応だが Routine を選べない。Mobile 側でも同等の 5 role 選択 UI を提供する。

#### Boundary

- やる:
  - Desktop `CreateItemPopover.tsx` / `RoleSwitcher.tsx` を 5 role 化（Routine 追加）
  - Mobile `MobileScheduleItemForm.tsx` に 5 role セレクタを追加、role 別に必要フィールドを動的切替
  - 共有の `ScheduleRole = 'event' | 'task' | 'routine' | 'note' | 'daily'` 型を `types/schedule.ts` に導入 or 既存型を参照
  - Routine は既存 `RoutineProvider.createRoutine` 経由で作成
- やらない:
  - Routine の繰り返しルール UI の大幅刷新（既存 Routine 作成フローを呼び出すのみ）
  - DB スキーマ変更（既存 `routines` / `schedule_items` の関連で完結）

#### Acceptance Criteria

- [ ] AC1: Mobile の add item で Events / Tasks / Routine / Notes / Daily の 5 role を選択できる
- [ ] AC2: Routine 選択時は既存 Routine 作成フロー（繰り返しパターン指定）に接続される
- [ ] AC3: Note / Daily 選択時は既存 note / daily の参照 or 新規作成が可能
- [ ] AC4: Desktop の CreateItemPopover でも Routine が選べるようになる
- [ ] AC5: 選択した role が schedule_items の role 列に正しく保存される

#### Dependencies

- 他機能: Routine（`RoutineProvider`）/ Notes / Daily
- 既存資産: `CreateItemPopover.tsx` / `RoleSwitcher.tsx` / `MobileScheduleItemForm.tsx`

---

## Section: Work

Mobile `work` タブ（Pomodoro Timer）に関する追加要件。
元 note 原文:

- Work の Task を選択する際に、background が透明になっているため視認性が非常に悪いため不透明にする
- タイマー上のワーク、少休憩、長休憩のタブを押して長休憩のタブがメインになったあとにタブを押してもタイマーがスタート、ストップの繰り返しになる。
- タブの配置をタイマー上ではなく右上に配置する

---

### W-1: Task 選択時の背景を不透明にする

**Status**: ✓ Done（2026-04-24 — Known Issue 015 `notion-*-primary` サフィックス修正で解消）
**Owner Provider/Module**: `frontend/src/components/Mobile/MobileWorkView.tsx` / Task Picker 部品
**Depends on Feature**: Pomodoro Timer（Tier 2）
**Platform**: iOS only

#### Purpose

Work 画面で Task 選択 UI（Task Picker）を表示した際、背景が半透明（opacity / alpha 低）で後ろが透けて視認性が落ちている。背景を完全不透明にして読みやすくする。

#### Boundary

- やる:
  - Task Picker のラッパ背景の opacity / alpha を除去し、`bg-notion-bg-primary` 等の solid 色に
  - オーバーレイが別要素にかかっている場合はそちらの alpha も見直す
- やらない:
  - Task Picker の機能追加（選択ロジック変更なし）
  - Desktop 側の Task Picker への波及（要件は Mobile Work 限定）

#### Acceptance Criteria

- [ ] AC1: Work 画面で Task Picker を開いた際、背後の UI が透けない
- [ ] AC2: Dark / Light テーマいずれでもテキストコントラストが WCAG AA を満たす

#### Dependencies

- 既存資産: `MobileWorkView.tsx` / notion-bg デザイントークン

---

### W-2: Long Break タブ後、タブタップが start/stop トグルになるバグ修正

**Status**: ✓ Done（2026-04-24 — timerReducer に `SET_SESSION_TYPE` 追加、タブタップは sessionType 切替のみ）
**Owner Provider/Module**: `frontend/src/components/Mobile/MobileWorkView.tsx` SessionTabs / `TimerContext`
**Depends on Feature**: Pomodoro Timer（Tier 2）
**Platform**: iOS only

#### Purpose

Long Break タブをタップしてアクティブ化した後、同じ Long Break タブをもう一度タップすると `timer.start()` → `timer.pause()` の無限トグルに落ち込むバグを解消する。タブタップはあくまで `sessionType` 切替のみで、start/stop は Control Dock のボタンに限定する。

#### Boundary

- やる:
  - SessionTabs の onClick ハンドラを「アクティブな sessionType との一致時は no-op」に変更
  - または click 時に `timer.start` / `pause` を呼ばない分岐を明示
  - Timer の start/stop は Control Dock の Play/Pause ボタンから行う（既存動作）
- やらない:
  - 3 タブ（Focus / Break / Long Break）構成の変更
  - Control Dock のボタン機能変更

#### Acceptance Criteria

- [ ] AC1: 現在アクティブな sessionType のタブをタップしても start/stop はトグルされない
- [ ] AC2: 別 sessionType のタブタップでは sessionType が切り替わるのみで、タイマーは自動開始しない（既存仕様維持）
- [ ] AC3: Control Dock の Play/Pause は従来通り動作する

#### Dependencies

- 既存資産: `TimerContext` / `MobileWorkView.tsx` SessionTabs
- 関連デバッグ: `CLAUDE.md §7.5` IPC 未登録の項と同じトラブルシュート文化で root cause を `known-issues/` に記録

---

### W-3: タブ配置をタイマー上から右上へ移動

**Status**: ✓ Done（2026-04-24 — SessionTabs をコンパクト化してトップバー右寄せに移動）
**Owner Provider/Module**: `frontend/src/components/Mobile/MobileWorkView.tsx`
**Depends on Feature**: Pomodoro Timer（Tier 2）
**Platform**: iOS only

#### Purpose

現状 SessionTabs（Focus / Break / Long Break）がタイマー Arc の上に配置され、Timer 本体の視認性を下げている。Mobile ヘッダー右上 or Work 画面上部右寄せに配置換えして、Timer Arc を画面中央にスッキリ表示する。

#### Boundary

- やる:
  - SessionTabs を MobileLayout のグローバルヘッダー右上に置く、または MobileWorkView 内上部右寄せに移す
  - Timer Arc と Control Dock の縦レイアウトを再調整（中央揃え、干渉しないこと）
- やらない:
  - UndoRedoButtons（G-1）との同居が難しい場合は MobileWorkView 内上部右寄せを第一候補に

#### Acceptance Criteria

- [ ] AC1: SessionTabs がタイマー Arc の上にかぶっていない
- [ ] AC2: タブは画面右上 or Work 画面上部右寄せに配置される
- [ ] AC3: Timer Arc / Control Dock の表示に干渉しない
- [ ] AC4: Landscape（横向き）でもレイアウトが崩れない

#### Dependencies

- 既存資産: `MobileWorkView.tsx` / `MobileLayout.tsx`（G-1 UndoRedo と同じエリア）
