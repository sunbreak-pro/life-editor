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

**Status**: × 未着手
**Owner Provider/Module**: `frontend/src/components/Mobile/shared/`（新設想定）/ 既存 `frontend/src/components/shared/UndoRedo/UndoRedoButtons.tsx` を流用
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

- [ ] AC1: Mobile の各セクション（Schedule / Memo / Note / Tasks / Materials / Work / Settings）のヘッダー右上に Undo / Redo の 2 ボタンが表示される
- [ ] AC2: 各ボタンは現在アクティブなドメインの履歴に応じて enabled / disabled が切り替わる
- [ ] AC3: タップで Desktop の Cmd+Z / Cmd+Shift+Z と同じドメインスタックの 1 ステップを取り消し / やり直しできる

#### Dependencies

- 他機能: UndoRedo（`UndoRedoProvider`）
- 既存資産: `frontend/src/components/shared/UndoRedo/UndoRedoButtons.tsx` / `frontend/src/utils/undoRedo/`
- 新規実装: Mobile 共通ヘッダーコンポーネント（現状 `Mobile*View.tsx` ごとに個別実装されているヘッダーを統合する余地あり）

---

### G-2: Cloud Sync をモバイル回線（4G/5G）でも実行可能にする

**Status**: × 未調査（コード側ゲーティングは grep で未検出 — プラットフォーム設定側の可能性が高い）
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

**Status**: × 未着手
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

- [ ] AC1: Mobile の各画面ヘッダー左端「Life Editor」横にハンバーガーアイコンが表示される
- [ ] AC2: ハンバーガータップで左から Drawer がスライドインし、Drawer 内に現在のセクションの RightSidebar 内容が表示される
- [ ] AC3: Drawer 外タップ または Drawer 左端から左方向のスワイプで Drawer が閉じる
- [ ] AC4: Mobile 省略 Provider に依存する RightSidebar 内 UI は表示されない（Optional hook ガード）

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

**Status**: × 未着手
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

- [ ] AC1: 画面左端から右方向にスワイプすると、直前の `activeSection` に戻る
- [ ] AC2: ナビゲーション履歴が空のときはジェスチャーが何もしない（またはバウンス的に視覚フィードバックのみ）
- [ ] AC3: G-3 の Drawer 開閉ジェスチャー / DnD / TipTap 編集中の選択操作と衝突しない（左端 16-24px 起点に限定し、縦スクロールとも区別）

#### Dependencies

- 他機能: Section Routing（`App.tsx` activeSection 切替）/ G-3 Drawer ジェスチャー（衝突回避）
- 既存資産: なし（新規）

---

## Section: Per-section（未取得）

元 note のスクロール先（Schedule / Tasks / Notes / Memo 等の個別セクション）は本セッションでは未取得。
取得次第、本ファイルに `## Section: <SectionName>` として追記する。
