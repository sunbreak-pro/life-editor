# Tier 2 — Supporting Features

> 補助機能 / Tier 1 の補完。Phase B-2 で各機能の要件を記入する。
> テンプレ・記入手順は [README.md](./README.md) 参照。Tier 2 は AC を 3-5 件に簡略化可。

**Tier 2 機能数**: 12（暫定、Phase B-2 で確定）

---

## Feature: Audio Mixer

**Tier**: 2
**Status**: ◎完成
**Owner Provider/Module**: `AudioProvider` / `frontend/src/components/Work/Music/` / `src-tauri/src/commands/{sound,custom_sound}_commands.rs`
**MCP Coverage**: —
**Supports Value Prop**: 補助（V1/V2/V3 直接支えず）
**Platform**: Desktop only（Mobile では AudioProvider 省略 — CLAUDE.md §5）

### Purpose

集中作業中の環境音ミキサー。6 種プリセット（Rain / Thunder / Wind / Ocean / Birds / Fire）+ カスタムサウンドを個別にミックスし、Pomodoro Timer / Playlist と連動して「没入型ワークフロー」を形成する。Tier 1 機能には寄与しないが、V2 Target User の特性（§2「環境音 + ポモドーロタイマーの没入型」）を直接満たす補助機能。

### Boundary

- やる:
  - 6 種環境音の on/off + 個別ボリューム（0-100）
  - カスタムサウンドアップロード（MP3 / WAV / OGG、20MB 制限、magic bytes 検証）
  - サウンドへのタグ付与（色付きドット、最大 4 個表示）
  - プレビュー再生（個別サウンドの試聴）
  - プリセット保存（複数音の組合せ + ボリューム）
  - Work 画面での「favorites」選択（workscreen_selections）
  - カスタム表示名（`update_sound_display_meta`）
- やらない:
  - 楽曲ストリーミング（Spotify / Apple Music 連携なし）
  - 外部サウンドライブラリ連携
  - Mobile での Audio Mixer（AudioProvider 省略）

### Acceptance Criteria

- [ ] AC1: 6 種環境音の on/off + ボリュームを個別に変更でき、設定は `sound_settings` に即時保存されて再起動後も復元される
- [ ] AC2: MP3 / WAV / OGG ファイル（20MB 以下）をカスタムサウンドとしてアップロードでき、magic bytes 検証により不正ファイルは拒否される
- [ ] AC3: 複数音 + ボリューム組合せをプリセットとして保存 / 削除でき、ワンタップで呼び戻せる
- [ ] AC4: 各サウンドにタグを付与すると、サウンド行に色付きドット（最大 4 個）が表示され、タグでフィルタ可能
- [ ] AC5: ユーザー操作（ボタンクリック）以降に `AudioContext` が resume され、初回ロード直後の無音状態が解消される

### Dependencies

- DB Tables: `sound_settings` / `sound_presets` / `sound_tag_definitions` / `sound_tag_assignments` / `sound_workscreen_selections`
- IPC Commands: `db_sound_{fetch_settings,update_setting}` / `db_sound_{fetch,create,delete}_preset` / `db_sound_{fetch_all,create,delete}_sound_tag` / `db_sound_set_tags_for_sound` / `db_sound_update_sound_display_meta` / `db_sound_set_workscreen_selections` / `db_custom_sound_*`
- 他機能: Pomodoro Timer（連動再生）/ Playlist（カスタムサウンドを含むトラック再生）
- ファイル: `public/sounds/`（gitignore 対象）+ カスタムサウンドは data_dir に blob 保存

### Known Issues / Tech Debt

- `AudioContext` state suspended → ユーザー操作後 `resume()` 必要（CLAUDE.md §10.5）
- カスタムサウンドは attachments と同じくファイルベース（DB テーブルなし）

---

## Feature: Playlist

**Tier**: 2
**Status**: ◎完成
**Owner Provider/Module**: `frontend/src/components/Work/Music/Playlist/` / `src-tauri/src/commands/playlist_commands.rs`
**MCP Coverage**: —
**Platform**: Desktop only（AudioProvider 依存）

### Purpose

Audio Mixer のサウンド（プリセット / カスタム）を任意の順序でリスト化し、Pomodoro Timer と連動してシーケンシャル / シャッフル / リピート再生する。作業開始時に手動でサウンドを組み合わせる手間を削減し、タスクごとに異なる音環境を使い分けられるようにする。

### Boundary

- やる:
  - 複数プレイリスト管理（作成 / 名前変更 / 削除）
  - アイテム追加 / DnD 並び替え（dnd-kit、activationConstraint: 5px）
  - トラックごとのタグ付与
  - タイマー連動再生（`timer.isRunning && timerPlaylistId` で自動開始）
  - 再生モード: シーケンシャル / シャッフル / リピート
  - シークバー / ボリューム調整
  - インラインでのトラック名編集（Enter 確定 / Escape キャンセル）
- やらない:
  - 外部ストリーミングサービスからのトラック追加（Audio Mixer と同じく楽曲未対応）
  - Mobile での Playlist 利用

### Acceptance Criteria

- [ ] AC1: 複数プレイリストを作成し、Audio Mixer 側に登録済みのサウンド（プリセット + カスタム）をアイテムとして追加 / 削除できる
- [ ] AC2: DnD でアイテム順序を変更すると `db_playlists_reorder_items` が呼ばれ、再起動後も順序が維持される
- [ ] AC3: Pomodoro Timer を開始し、そのタイマーに紐付けたプレイリストがあれば自動的に先頭トラックから再生される（シャッフル ON のときはランダム）
- [ ] AC4: リピート ON のときはリスト末尾で先頭に戻り、OFF のときは停止する
- [ ] AC5: タイマーを Pause / Resume するとプレイリストも追従して停止 / 再開する

### Dependencies

- DB Tables: `playlists` / `playlist_items`
- IPC Commands: `db_playlists_fetch_all|create|update|delete` / `db_playlists_fetch_items|add_item|remove_item|reorder_items`
- 他機能: Audio Mixer（サウンド供給）/ Pomodoro Timer（連動開始 / 停止）

---

## Feature: Pomodoro Timer

**Tier**: 2
**Status**: ◎完成
**Owner Provider/Module**: `TimerProvider` / `frontend/src/components/Work/Timer/` / `src-tauri/src/commands/timer_commands.rs`
**MCP Coverage**: —

### Purpose

集中作業サイクルを WORK / BREAK / LONG_BREAK の 3 モードで管理し、プリセット + 自動休憩 + 完了モーダル + セッション DB 記録を提供する。Task と紐付けると `timer_sessions` に task_id が記録され、Analytics / サイドバー / TaskTree 各所に残り時間が同期表示される。

### Boundary

- やる:
  - 3 モード（`WORK` / `BREAK` / `LONG_BREAK`）の切替、`sessionsBeforeLongBreak` で長休憩タイミング決定
  - 複数プリセット（WORK 分 / BREAK 分 / LONG_BREAK 分 / sessionsBeforeLongBreak を保存）
  - ドットインジケーター（`currentSession = (completedSessions % sessionsBeforeLongBreak) + 1`）
  - 一時停止中のみ ±5 分調整ボタン
  - WORK 完了時: 完了音 + デスクトップ通知 + `SessionCompletionModal`
  - `autoStartBreaks: true` で休憩自動開始
  - タスク紐付け（`startForTask(id, title)`）で `timer_sessions.task_id` 記録
  - サイドバー / TaskTree 行 / Work 画面の残り時間が一致表示
  - Mobile（iOS）でもタイマー自体は動作（§5 Mobile 対応）
- やらない:
  - Mobile トレイアイコン（`updateTrayTimer` は Desktop 限定、Mobile では skip）
  - タイマー完了時の紙吹雪（タスク完了時のみ fire、§Tasks AC2 参照）
  - 複数タイマー並列実行

### Acceptance Criteria

- [ ] AC1: プリセットを作成 / 選択すると WORK / BREAK / LONG_BREAK 分数と `sessionsBeforeLongBreak` が保存され、次回起動時も復元される
- [ ] AC2: WORK 完了時に完了音 + デスクトップ通知 + `SessionCompletionModal` が表示され、`autoStartBreaks: true` なら自動で BREAK が開始される
- [ ] AC3: `startForTask` で起動したタイマーの残り時間が Work 画面 / サイドバー / TaskTree 行の 3 箇所で同じ値として表示される
- [ ] AC4: 一時停止中のみ ±5 分ボタンが有効化され、タイマー稼働中は無効化される
- [ ] AC5: 完了したセッションは `timer_sessions` に `task_id` / `session_type` / 開始 / 終了時刻付きで記録され、Analytics で集計される
- [ ] AC6: `sessionsBeforeLongBreak=4` のとき、4 セッション目の WORK 完了後に `LONG_BREAK` が開始される

### Dependencies

- DB Tables: `timer_settings`（シングルトン）/ `timer_sessions` / `pomodoro_presets`
- IPC Commands: `db_timer_fetch_settings|update_settings` / `db_timer_{start,end,fetch}_session[s]` / `db_timer_{fetch,create,update,delete}_pomodoro_preset[s]`
- 他機能: Tasks（task_id 紐付け）/ Audio Mixer（完了音）/ Playlist（timerPlaylistId 連動開始）/ Analytics（セッション集計）

### Known Issues / Tech Debt

- モバイルで `updateTrayTimer` を skip（`isTauriMobile()` ガード、2026-04-18 修正済み）
- 複数タイマー並列実行未対応（1 タスク = 1 タイマー前提）

---

## Feature: WikiTags

**Tier**: 2
**Status**: ◎完成
**Owner Provider/Module**: `WikiTagProvider` / `frontend/src/components/WikiTags/` / `src-tauri/src/commands/{wiki_tag,wiki_tag_group,wiki_tag_connection}_commands.rs`
**MCP Coverage**: `list_wiki_tags` / `tag_entity` / `search_by_tag` / `get_entity_tags`
**Platform**: Desktop only（Mobile では WikiTagProvider 省略 — CLAUDE.md §5）

### Purpose

Notes / Dailies / Schedule Items など RichTextEditor を持つエンティティを横断して単一のタグ体系で束ねる「wiki-style」タグシステム。インラインタグ（`#tag` 記法）による自動認識と、タグの有向接続 / グルーピングで知識の構造化を支援する。Tasks は RichTextEditor を持たないため対象外（タグ付けは CalendarTags が担当）。

### Boundary

- やる:
  - エンティティ横断のタグ付与（`entity_type` + `entity_id` ベース）
  - インラインタグ（content 内の `#tag` を `sync_inline_tags` で自動抽出・assign、`source='inline'` 記録）
  - タグの色管理（UI カラーピッカー）
  - タググループ（note 集合の統計・フィルタ用、`filter_tags` 指定可）
  - タグ接続（source → target の有向グラフ、semantics / hierarchy 表現）
  - タグのマージ（`merge` コマンドで重複統合）
  - MCP 4 ツール（Claude から横断検索・タグ付与）
- やらない:
  - 複数 entity_type を跨ぐリレーション型タグ（Database の relation プロパティで別対応）
  - Mobile での WikiTag 利用（WikiTagProvider 省略）
  - 権限管理（個人利用前提、§4 NG-1）
  - Tasks へのタグ付与（Task は RichTextEditor を持たないため UI 上で付与経路がなく、タグ管理は CalendarTags に集約。MCP `tag_entity` の entity_type='task' も将来要件として保留）

### Acceptance Criteria

- [ ] AC1: Note / Daily / Schedule Item のいずれのエンティティにも同じ WikiTag を付与でき、`search_by_tag` で 3 ドメイン横断結果が返る（Tasks は対象外）
- [ ] AC2: Note や Memo の本文に `#tag` を書いて保存すると、`sync_inline_tags` により自動で assign が作られ `source='inline'` が記録される。タグを本文から消すと assign も自動削除される
- [ ] AC3: WikiTagManager UI でタグを作成 / 色変更 / 削除でき、削除時は関連 assignments / group members / connections がカスケードで整理される
- [ ] AC4: タグ A → タグ B の接続を作成し、`list_wiki_tags` に hierarchy 情報が含まれる（1 対多の有向グラフ）
- [ ] AC5: MCP `tag_entity(entity_type, entity_id, tag_name)` でタグ付与 → UI 側に即時反映される（再読込後）

### Dependencies

- DB Tables: `wiki_tags` / `wiki_tag_assignments` / `wiki_tag_connections` / `wiki_tag_groups` / `wiki_tag_group_members`
- IPC Commands: `db_wiki_tags_*`（fetch*all / search / create / update / delete / merge / fetch_for_entity / set_for_entity / sync_inline / restore_assignment 11 件）/ `db_wiki_tag_groups*_`6 件 /`db*wiki_tag_connections*_` 4 件
- 他機能: Notes / Dailies / Schedule / Database（entity_type を拡張すれば対応可。Tasks は本仕様で対象外）

---

## Feature: File Explorer

**Tier**: 2
**Status**: ○基本完成
**Owner Provider/Module**: `FileExplorerProvider` / `frontend/src/components/Materials/Files/` / `src-tauri/src/commands/{files,attachment}_commands.rs`
**MCP Coverage**: `list_files` / `read_file` / `write_file` / `create_directory` / `rename_file` / `delete_file` / `search_files`
**Platform**: Desktop only（Mobile では FileExplorerProvider 省略 — CLAUDE.md §5）

### Purpose

ユーザー指定の単一ルートフォルダ配下でファイル / ディレクトリを管理する Materials セクション。Life Editor 内で完結する作業素材（スクリプト / ドラフト / 参考資料）を SSOT と同じアプリ内に置くことで、Claude が MCP `read_file` / `write_file` で対話的に扱える状態を作る。

### Boundary

- やる:
  - ユーザー選択のルートフォルダ（`files_select_folder` / `app_settings` に保存）
  - 相対パスベースのファイル / ディレクトリ CRUD（パストラバーサル検証、MAX 50MB）
  - テキストファイルの Inline 編集（FileEditor + FileEditorToolbar）
  - ファイルプレビュー（FileExplorerView）
  - Attachments（FS ベース、data_dir に blob 保存、DB テーブルなし）
  - `open_in_system` で OS ファイラ / 既定アプリ起動
  - MCP 7 ツールによる Claude 経由の読み書き
- やらない:
  - Mobile での File Explorer 利用（FileExplorerProvider 省略）
  - クラウドストレージ連携（Google Drive は MCP 経由で将来対応）
  - 50MB 超のファイル読み込み
  - バイナリエディタ

### Acceptance Criteria

- [ ] AC1: 初回起動時に `files_select_folder` でルートフォルダを選択すると `app_settings` に保存され、次回起動時に復元される
- [ ] AC2: ルート配下でファイル作成 / リネーム / 移動 / 削除 / ディレクトリ作成が UI と MCP の両方から実行でき、ルート外へのパストラバーサル（`../../...`）は拒否される
- [ ] AC3: テキストファイルを FileEditor で編集して保存すると、`write_text_file` により永続化され、MCP `read_file` で同じ内容が取得できる
- [ ] AC4: Attachment（`attachment_save`）でバイナリを保存するとメタ + blob が data_dir に書き込まれ、`attachment_load` で取り出せる
- [ ] AC5: Mobile ビルドでは FileExplorerProvider が hydrate されず、Materials セクションの Files サブビューが表示されない

### Dependencies

- ファイルシステム: ユーザー選択ルートフォルダ + `data_dir`（attachments）
- DB Tables: なし（`app_settings` にルートパスのみ保存、attachments は FS ベース）
- IPC Commands: `files_*` 13 件（`select_folder` / `get_root_path` / `list_directory` / `get_file_info` / `read_text_file` / `read_file` / `create_directory` / `create_file` / `write_text_file` / `rename` / `move` / `delete` / `open_in_system`）/ `attachment_*` 4 件（`save` / `load` / `delete` / `fetch_metas`）
- 他機能: Notes（リッチペースト時の画像添付）/ MCP Server（7 ツール経由 Claude アクセス）

---

## Feature: Templates

**Tier**: 2
**Status**: ◎完成
**Owner Provider/Module**: `TemplateProvider` / `frontend/src/components/Templates/` / `src-tauri/src/commands/template_commands.rs`
**MCP Coverage**: —

### Purpose

タスクツリー構造を丸ごと保存 / 展開して、定型プロジェクトや週次ルーチンの立ち上げコストをゼロにする。現状は `templates` テーブル単一で運用され、`content` カラムに JSON として構造を格納する。

### Boundary

- やる:
  - タスクツリー構造の JSON シリアライズ保存（`name` + `content`）
  - テンプレート一覧 / 作成 / 更新 / ソフトデリート / 完全削除
  - 展開時: 選択した配置先（フォルダ / ルート）に新規 ID で再生成
- やらない:
  - Database (Notion 風 DB) のテンプレート（Database 機能側の Future Enhancements で別対応）
  - Note テンプレート / Memo テンプレート（現状未対応、Future で検討）
  - テンプレートのバージョニング / 差分管理

### Acceptance Criteria

- [ ] AC1: 既存の TaskTree から選択したサブツリーを「Save as Template」でテンプレート保存すると、`templates` テーブルに `name` + JSON `content` として記録される
- [ ] AC2: テンプレート一覧から「Insert」すると、指定配置先にツリー構造が新規 ID で展開される（元のテンプレートは変更されない）
- [ ] AC3: テンプレートをソフトデリートすると一覧から消え、Trash から復元 / 完全削除できる
- [ ] AC4: テンプレート名を変更すると `db_templates_update` で保存され、再起動後も反映される

### Dependencies

- DB Tables: `templates`（アクティブ運用中）/ `task_templates`（レガシーテーブル、migrations.rs で作成されるが CRUD コマンドなし、data_io_commands.rs のリセット時のみ DELETE 対象）
- IPC Commands: `db_templates_fetch_all|fetch_by_id|create|update|soft_delete|permanent_delete`
- 他機能: Tasks（主対象）/ Trash（復元）

### Known Issues / Tech Debt

- `task_templates` テーブルがレガシー残留（V2 マイグレーションで作成されたが現行 Templates 機能は `templates` のみ使用）。将来の DB クリーンアップで削除検討

---

## Feature: UndoRedo

**Tier**: 2
**Status**: ◎完成
**Owner Provider/Module**: `UndoRedoProvider` / `frontend/src/utils/undoRedo/` / `frontend/src/context/UndoRedoContext.tsx`
**MCP Coverage**: —

### Purpose

コマンドパターン + ドメイン別スタックで、破壊的操作の即時取り消しを全ドメイン（Tasks / Notes / Memo / Schedule 等）で統一的に提供する。`Cmd+Z` / `Cmd+Shift+Z` とヘッダーボタンの 2 経路から同じ履歴を操作できる。

### Boundary

- やる:
  - ドメイン別スタック（Tasks / Notes / Memo / Schedule / Database / etc. が独立して履歴保持）
  - Cmd+Z / Cmd+Shift+Z（macOS）/ Ctrl+Z / Ctrl+Shift+Z（Windows/Linux）対応
  - 各セクションヘッダーの Undo/Redo ボタン
  - 複合操作の 1 ステップ化（例: 削除カスケードを単一 Undo で巻き戻し）
- やらない:
  - アプリ再起動を跨いだ履歴永続化（セッション内メモリのみ）
  - MCP 経由の操作の Undo（Claude の操作は UI 側履歴に含まれない）
  - IME 入力中の Undo 乗っ取り（`isComposing` で抑止）

### Acceptance Criteria

- [ ] AC1: Tasks / Notes / Memo / Schedule の任意 CRUD を実行後、Cmd+Z で 1 ステップずつ取り消せる。続けて Cmd+Shift+Z でやり直せる
- [ ] AC2: ドメインごとの履歴が独立しており、Tasks で Undo しても Notes の編集履歴には影響しない
- [ ] AC3: セクションヘッダーの Undo/Redo ボタンが履歴状態に応じて有効 / 無効化され、キーボード経路と同じ操作を実行する
- [ ] AC4: IME 入力中（`nativeEvent.isComposing`）の Cmd+Z は Undo ではなく変換キャンセルとして扱われる
- [ ] AC5: アプリ再起動後は履歴スタックが空（前セッションの Undo は不可）

### Dependencies

- 他機能: Tasks / Notes / Memo / Schedule（全 CRUD ドメイン）/ Database

---

## Feature: Theme

**Tier**: 2
**Status**: ◎完成
**Owner Provider/Module**: `ThemeProvider` / `frontend/src/context/ThemeContext.tsx`
**MCP Coverage**: —

### Purpose

ダーク / ライトモードとフォントサイズ（12-25px の 10 段階スライダー）を Settings から切替可能にする。Tailwind デザイントークン（`notion-*`）経由で全 UI コンポーネントに一貫適用される。

### Boundary

- やる:
  - ダーク / ライト 2 モード切替（Settings > General）
  - フォントサイズ 10 段階（12px / 14px / … / 25px）
  - システムテーマ自動追従（OS ダークモード検出）
  - 設定の DB 永続化（`app_settings`）
- やらない:
  - 任意カスタムカラー / アクセント色（デザイントークンで固定）
  - Terminal のテーマ変更（Catppuccin Mocha 固定、§Terminal Boundary）

### Acceptance Criteria

- [ ] AC1: Settings でダーク / ライトを切り替えると全 UI が即時更新され、再起動後も選択が維持される
- [ ] AC2: フォントサイズスライダーで 10 段階選択でき、テキストのみが拡大 / 縮小され、レイアウト崩れが発生しない
- [ ] AC3: System モードを選ぶと OS ダークモード変更（macOS の Appearance 設定等）に自動追従する

### Dependencies

- DB Tables: `app_settings`
- ライブラリ: Tailwind CSS v4 デザイントークン（`notion-*`）

---

## Feature: i18n

**Tier**: 2
**Status**: ◎完成
**Owner Provider/Module**: `react-i18next` / `frontend/src/i18n/locales/{en,ja}.json`
**MCP Coverage**: —

### Purpose

Life Editor の全 UI を en / ja で切替可能にする。Settings からいつでも言語変更でき、TipTap / Schedule / Toast 等のコンポーネントも全て翻訳に追従する。

### Boundary

- やる:
  - en / ja 2 言語対応
  - 全 UI テキストの `useTranslation()` 化（プレースホルダ `{{var}}` 含む）
  - Settings からの即時切替 + `app_settings` への永続化
  - 共有コンポーネントは props で i18n テキストを受け取り、自身では `useTranslation` を呼ばない（§9.3 共有コンポーネント設計）
- やらない:
  - 他言語追加（必要時に検討）
  - LTR 以外のレイアウト（RTL 等、現状未対応）
  - 日付 / 数値フォーマットのロケール分離（将来 Intl API 導入検討）

### Acceptance Criteria

- [ ] AC1: Settings で en / ja を切り替えると全 UI（メニュー / ボタン / モーダル / Toast）が即時言語変更される
- [ ] AC2: 新規 UI テキストは `en.json` / `ja.json` 両方にキー追加必須（CLAUDE.md §10.6 Review Checklist 準拠）
- [ ] AC3: i18n キー未定義の場合は `keys.path.fallback` が画面に現れず、最低限英語フォールバックが表示される

### Dependencies

- DB Tables: `app_settings`（選択言語保存）
- 全 UI コンポーネント

---

## Feature: Shortcuts

**Tier**: 2
**Status**: ◎完成
**Owner Provider/Module**: `ShortcutConfigProvider` / `frontend/src/context/ShortcutConfigContext.tsx`
**MCP Coverage**: —
**Platform**: Desktop only（Mobile では ShortcutConfigProvider 省略 — CLAUDE.md §5）

### Purpose

29 件のキーボードショートカット（6 カテゴリ: Navigation / Tasks / Schedule / Timer / Editor / System）を集中管理し、Tips 画面で一覧 / Settings でカスタマイズ可能にする。ユーザー操作の大半をマウス無しで完結させる生産性の基盤。

### Boundary

- やる:
  - 6 カテゴリ × 計 29 ショートカットの定義 + Tips 画面での一覧表示
  - ユーザーカスタマイズ（キー割当変更、DB 永続化）
  - 重複検出（同一キーを複数アクションに割当できない）
  - Cmd+K（コマンドパレット 16 コマンド）/ Ctrl+` （Terminal）/ Cmd+Z（Undo）等の標準キー
- やらない:
  - Mobile でのショートカット利用（ShortcutConfigProvider 省略、OS キーボード非前提）
  - アプリ外からのグローバルショートカット登録（Tauri global-shortcut 未導入）

### Acceptance Criteria

- [ ] AC1: Tips 画面で 29 件 / 6 カテゴリのショートカット一覧が表示され、各カテゴリが折りたたみ可能
- [ ] AC2: Settings > Advanced でショートカットを別キーに再割当でき、重複は保存時に警告される
- [ ] AC3: Cmd+K でコマンドパレット、Ctrl+` で Terminal、Cmd+Z で Undo がアプリ全体で動作する
- [ ] AC4: 再割当は DB に永続化され、再起動後も反映される

### Dependencies

- DB Tables: `app_settings`（ショートカット設定保存）
- 他機能: Tasks / Schedule / Timer / Settings / CommandPalette / Terminal / UndoRedo

---

## Feature: Toast

**Tier**: 2
**Status**: ◎完成
**Owner Provider/Module**: `ToastProvider` / `frontend/src/context/ToastContext.tsx`
**MCP Coverage**: —

### Purpose

軽量な一時通知 UI。CRUD 成功 / エラー / 情報 / 警告を非破壊的に伝える（ユーザーの入力を邪魔しない）。永続的な通知は Settings の構造化ログに任せる。

### Boundary

- やる:
  - 4 種トースト（`success` / `error` / `info` / `warning`）
  - 自動消滅（デフォルト数秒）+ 明示クローズ
  - スタック表示（複数トースト同時表示）
  - ドメインエラーの共通表示パターン（現状は各 Provider が try/catch → showToast を個別実装）
- やらない:
  - 永続的な通知履歴（Settings の構造化ログで対応）
  - ユーザー応答を要求する確認ダイアログ（Modal で別対応）
  - プッシュ通知（OS 通知は Timer のみ）

### Acceptance Criteria

- [ ] AC1: `showToast(type, message)` を呼ぶと対応する色 + アイコンのトーストが画面右下等に表示され、数秒で自動消滅する
- [ ] AC2: 複数トーストが短時間に連続発火した場合にスタック表示され、古いものから順に消える
- [ ] AC3: 明示的な × ボタンで即時クローズできる
- [ ] AC4: Routine 削除カスケード等のドメイン操作成功時にも成功トーストが表示される

### Known Issues / Tech Debt

- ~~保留 S-5: `useServiceErrorHandler` 共通ヘルパ未実装~~ → **解消 (2026-04-18)**: `frontend/src/hooks/useServiceErrorHandler.ts` を新設し、`errors.*` i18n キー + rate-limit (5s) を統合。TimerContext / SyncContext / MobileCalendarView の silent failure を toast 化済み

### Related Plans

- COMPLETED: `.claude/archive/2026-04-18-service-error-handler-hook.md`（S-5 実装完了）

---

## Feature: Trash (ソフトデリート復元)

**Tier**: 2
**Status**: ◎完成
**Owner Provider/Module**: `frontend/src/components/Trash/` / 全 Repository（`is_deleted` + `deleted_at` カラム）
**MCP Coverage**: —

### Purpose

全ドメインで共通のソフトデリート（`is_deleted=1` + `deleted_at`）モデルを、単一の TrashView UI で復元 / 完全削除できるようにする。誤削除からの復旧窓口。

### Boundary

- やる:
  - Tasks / Notes / Memos / Routines / Databases / Templates / ScheduleItems の復元 / 完全削除
  - カスタムサウンドは FS ベースだが TrashView に相当する復元窓口を提供
  - ドメイン別タブ切替（削除済み Tasks / Notes 等を別々に表示）
  - 一括完全削除
- やらない:
  - 削除からの自動パージ（30 日経過等の自動完全削除は未実装）
  - MCP 経由での完全削除（安全性配慮）
  - 削除前のバックアップ自動作成（Export/Import で補完）

### Acceptance Criteria

- [ ] AC1: Tasks / Notes / Memos / Routines / Databases / Templates を削除した後、TrashView のそれぞれのタブに表示され、`deleted_at` 降順で並ぶ
- [ ] AC2: Trash 画面から「復元」を選ぶと該当レコードが元の位置 / 親に戻り、`is_deleted=0` + `deleted_at=NULL` に更新される
- [ ] AC3: 「完全削除」を選ぶと確認ダイアログ経由で `permanent_delete` が呼ばれ、関連レコード（子タスク / assignments 等）もカスケード削除される
- [ ] AC4: カスタムサウンドの削除 / 復元は FS ベースでも TrashView に統合され、他ドメインと同じ UI で扱える

### Dependencies

- 全ソフトデリート対象テーブル（CLAUDE.md §7.3 参照）: Tasks / Notes / Memos / Routines / Databases / Templates / ScheduleItems + CustomSounds（FS）
- IPC Commands: 各ドメインの `*_restore` / `*_permanent_delete` コマンド
