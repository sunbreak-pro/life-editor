# Work セクション

`activeSection === "work"` で表示される画面。**ポモドーロタイマー + 環境音ミキサー + プレイリスト + セッション履歴**を扱う。

## 概要

3 つのタブで構成:

| Work タブ   | 中身                                                               |
| ----------- | ------------------------------------------------------------------ |
| **Timer**   | 円形プログレスのポモドーロタイマー。Free セッション / ルーチン連携 |
| **History** | 過去のセッション履歴 (`timer_sessions` テーブル)                   |
| **Music**   | 環境音 6 種 + カスタム音源 + プレイリスト + サウンドタグ           |

横串で扱うデータ:

- `timer_sessions` (セッション履歴、`session_type` = WORK / SHORT_BREAK / LONG_BREAK / FREE)
- `pomodoro_presets` (タイマー設定プリセット)
- `sounds` / `playlists` / `custom_sounds` / サウンドタグ (Audio Mixer)

## A. ルートとタブ切替

| 役割             | パス                                               | 何をしている                                                               |
| ---------------- | -------------------------------------------------- | -------------------------------------------------------------------------- |
| Section 親       | `frontend/src/components/Work/WorkScreen.tsx`      | `WorkTab = timer / history / music` 切替、Timer の中央レイアウト、完了確認 |
| Section 差し込み | `frontend/src/App.tsx` (`case "work":`)            | サイドナビ選択時の lazy mount (`Suspense`)                                 |
| 右サイドバー     | `frontend/src/components/Work/WorkSidebarInfo.tsx` | 現在のセッション / 音量 / 再生中音源を表示                                 |
| バレル export    | `frontend/src/components/Work/index.ts`            |                                                                            |

## B. タブ別の画面コンポーネント

### Timer タブ (`WorkScreen.tsx` 内で直接描画)

| ファイル                                                  | 役割                                |
| --------------------------------------------------------- | ----------------------------------- |
| `frontend/src/components/Work/TimerCircularProgress.tsx`  | 円形プログレスバー                  |
| `frontend/src/components/Work/TimerDisplay.tsx`           | 中央の時間表示 + 再生 / 停止ボタン  |
| `frontend/src/components/Work/TaskSelector.tsx`           | アクティブタスク選択 (タスク連携)   |
| `frontend/src/components/Work/TodaySessionSummary.tsx`    | 今日のセッション数・累計時間        |
| `frontend/src/components/Work/SessionCompletionModal.tsx` | セッション完了時のモーダル          |
| `frontend/src/components/Work/FreeSessionSaveDialog.tsx`  | Free セッション保存ダイアログ (V68) |

### History タブ

| ファイル                                              | 役割                                  |
| ----------------------------------------------------- | ------------------------------------- |
| `frontend/src/components/Work/WorkHistoryContent.tsx` | 過去セッション一覧 (`timer_sessions`) |

### Music タブ

| ファイル                                                 | 役割                                        |
| -------------------------------------------------------- | ------------------------------------------- |
| `frontend/src/components/Work/WorkMusicContent.tsx`      | Music タブ本体 (環境音 + プレイリスト)      |
| `frontend/src/components/Work/Music/MusicSoundItem.tsx`  | 1 音源カード (再生 / 音量 / タグ)           |
| `frontend/src/components/Work/Music/PlaylistManager.tsx` | プレイリスト一覧と作成 / 編集               |
| `frontend/src/components/Work/Music/PlaylistDetail.tsx`  | プレイリスト詳細                            |
| `frontend/src/components/Work/PlaylistSelectPopover.tsx` | プレイリスト選択ポップオーバー (Timer 連動) |
| `frontend/src/components/Work/Music/SoundTagManager.tsx` | サウンドタグの管理                          |
| `frontend/src/components/Work/Music/SoundTagFilter.tsx`  | サウンドタグでのフィルタ                    |
| `frontend/src/components/Work/Music/SoundTagEditor.tsx`  | サウンドタグの編集                          |

## C. 状態管理 (Context / Provider)

| Context        | 値定義                                      | Provider                                                       |
| -------------- | ------------------------------------------- | -------------------------------------------------------------- |
| `TimerContext` | `frontend/src/context/TimerContextValue.ts` | `frontend/src/context/TimerContext.tsx`                        |
| `AudioContext` | `frontend/src/context/AudioContextValue.ts` | `frontend/src/context/AudioContext.tsx` (Mobile では Optional) |

Provider 順序 (CLAUDE.md §6.2): ... → ScheduleItems → CalendarTags → **Timer → Audio** → WikiTag → ...。Audio は Timer に依存 (再生開始タイミングを Timer の `isRunning` に同期)。

### Timer ロジック

| ファイル                                               | 役割                                                     |
| ------------------------------------------------------ | -------------------------------------------------------- |
| `frontend/src/context/TimerContext.tsx::TimerProvider` | Pomodoro 状態機械 (WORK / REST / FREE / 一時停止 / 完了) |
| `frontend/src/context/timerReducer.ts`                 | 純粋な reducer (テスト済)                                |
| `frontend/src/context/TimerContext.test.tsx`           | 統合テスト                                               |

### Audio ロジック

| ファイル                                                                | 役割                                         |
| ----------------------------------------------------------------------- | -------------------------------------------- |
| `frontend/src/context/AudioContext.tsx::AudioProvider`                  | 環境音 / カスタム音源 / プレイリスト再生の親 |
| 内部利用: `usePlaylistData` / `usePlaylistPlayer` / `usePlaylistEngine` | プレイリスト管理 / 再生制御 / 再生エンジン   |

`AudioContext` は `timerPlaylistId` を localStorage で覚えていて、`timer.isRunning` が true になるとプレイリスト再生を始める。

## D. Hooks (Work 系)

| Hook                                                          | パス                                                                                      |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `useTimerContext`                                             | `frontend/src/hooks/useTimerContext.ts`                                                   |
| `useSessionCompletionToast`                                   | `frontend/src/hooks/useSessionCompletionToast.ts`                                         |
| `useAudioContext` / `useAudioContextOptional`                 | `frontend/src/hooks/useAudioContext.ts` / `useAudioContextOptional.ts`                    |
| `usePlaylistData` / `usePlaylistPlayer` / `usePlaylistEngine` | `frontend/src/hooks/usePlaylistData.ts` / `usePlaylistPlayer.ts` / `usePlaylistEngine.ts` |
| `useCustomSounds`                                             | `frontend/src/hooks/useCustomSounds.ts`                                                   |
| `useAudioFileUpload`                                          | `frontend/src/hooks/useAudioFileUpload.ts`                                                |
| `useSoundTags`                                                | `frontend/src/hooks/useSoundTags.ts`                                                      |
| `usePreviewAudio`                                             | `frontend/src/hooks/usePreviewAudio.ts` (タグ編集中のプレビュー)                          |

## E. データ層 / バックエンド

| 役割                         | パス                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------- |
| DataService インターフェース | `frontend/src/services/DataService.ts`                                        |
| Tauri 実装                   | `frontend/src/services/TauriDataService.ts`                                   |
| Rust コマンド (タイマー)     | `src-tauri/src/commands/timer_commands.rs`                                    |
| Rust コマンド (プリセット)   | `src-tauri/src/commands/pomodoro_preset_commands.rs`                          |
| Rust コマンド (音源)         | `src-tauri/src/commands/sound_commands.rs` / `custom_sound_commands.rs`       |
| Rust コマンド (プレイリスト) | `src-tauri/src/commands/playlist_commands.rs`                                 |
| 型                           | `frontend/src/types/timer.ts` / `sound.ts` / `customSound.ts` / `playlist.ts` |

## F. 設定 / Utility

| ファイル                                 | 役割                                        |
| ---------------------------------------- | ------------------------------------------- |
| `frontend/src/utils/pomodoroSettings.ts` | Free セッション保存ダイアログの ON/OFF など |
| `frontend/src/utils/sortSounds.ts`       | 音源のソート (`SoundSortMode`)              |
| `frontend/src/constants/sounds.ts`       | `SOUND_TYPES` (環境音 6 種の定義)           |

## G. 主要関数 / メソッド

- `WorkScreen.tsx::WorkScreen` — 3 タブの親。Timer 中央レイアウト、`handleCompleteSession` / `handleCompleteTask` の確認ダイアログ、`fetchTimerSessions` で本日の累計集計
- `TimerContext.tsx::TimerProvider` — `timerReducer` を内包して `start` / `pause` / `reset` / `startRest` / `startFreeSession` / `discardFreeSession` / `extendWork` / `adjustRemainingSeconds` などを公開
- `timerReducer.ts::timerReducer` — 純粋な state machine。`useReducer` 用 (テスト済)
- `AudioContext.tsx::AudioProvider` — `usePlaylistData` + `usePlaylistPlayer` を組み合わせて再生制御。`timer.isRunning` を観測してプレイリスト自動再生
- `usePlaylistEngine.ts` — Howler / Web Audio API 経由の再生エンジン (環境音は loop、プレイリストは順次再生)
- `useSessionCompletionToast.ts` — セッション完了時にトーストを出す副作用 hook (`WorkScreen` 上部で消費)
- `WorkScreen.tsx::Auto-discard effect` — `pendingFreeSave` で保存ダイアログが無効化されているとき自動的に discard (`isFreeSessionSaveDialogEnabled` 連動)
- `WorkMusicContent.tsx::WorkMusicContent` — Music タブ。`useAudioContext` + `useSoundTags` + `usePreviewAudio` + `useAudioFileUpload` を全部消費

## H. 副作用 / 注意点

- **`AudioContext` は `suspended` で始まる**: ブラウザ仕様で、ユーザー操作 (クリックなど) のあとに `resume()` しないと音が出ない (CLAUDE.md §3.4 / §7.5)。最初の再生ボタン押下時に `resume()` が必須
- **Timer と Audio は密結合**: `Audio` は Provider 順序で Timer の内側に置かれており、`timer.isRunning` を見て自動再生する。Timer のシグネチャを変えると Audio 側の effect が壊れる
- **`timer_sessions.session_type = 'FREE'`** は V68 で CHECK 制約に追加された経緯あり (Free モード INSERT 失敗の Known Issue)。新しい `session_type` 値を足すなら migration と CHECK 制約を同時更新
- **`timer_sessions.label`** は V66 で追加 (Pomodoro Free セッション命名用)
- **Mobile では `AudioProvider` 省略**。Music タブも Desktop 専用扱い (CLAUDE.md §2)。Mobile の Work タブは「標準ミュージックのみ」で、カスタム音源追加は非対応
- **`timer_sessions` は Cloud Sync **非**対象**: `VERSIONED_TABLES` に含まれていない (CLAUDE.md §4.1)。ローカル限定のセッションログ
- **`pomodoro_presets` / `sounds` / `custom_sounds` / `playlists` も Sync 非対象**。Desktop 単機運用
- **音源ファイルはコミット禁止** (`public/sounds/` は `.gitignore` 対象、CLAUDE.md §9)
- **Web 移行**: Audio 再生は Web Audio API + OPFS にそのまま乗る想定。Timer ロジックは `timerReducer` が純粋関数なので Phase 5 でも維持可能。Free セッション保存ダイアログだけ UI 調整が予想される
