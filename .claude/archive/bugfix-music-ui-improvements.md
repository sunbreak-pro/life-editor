# バグ修正 & Music UI改善プラン

**Status**: COMPLETED
**Created**: 2026-02-17

## Context

カレンダーからのタスク削除不具合、プレイリストのカスタムサウンド追加不具合、サウンドUI全体の改善、コンソールエラー修正の計7件を一括対応する。

---

## Issue 1: カレンダー月表示のタスク削除が動作しない

**根本原因**: `TaskPreviewPopup` の `useClickOutside(ref, onClose, true)` が `mousedown` で発火。`ConfirmDialog` は `createPortal` で `document.body` に描画されるため、確認ダイアログの「OK」を押した瞬間に click-outside が検出されポップアップがアンマウントされ、`onConfirm` が実行されない。

**修正ファイル**: `frontend/src/components/Calendar/TaskPreviewPopup.tsx`

**変更**: L37: `useClickOutside(ref, onClose, true)` → `useClickOutside(ref, onClose, !showDeleteConfirm)`

---

## Issue 2: プレイリストからカスタムサウンド追加が動作しない

**根本原因**: `PlaylistDetail.tsx` L168-173 の `handleAddCustomSound` がファイル入力の `onchange` ハンドラを設定していない。

**修正ファイル & 順序**:

1. `frontend/src/hooks/useCustomSounds.ts` — `addSound` の返り値を `{ error?: string; id?: string }` に拡張
2. `frontend/src/context/AudioContextValue.ts` — `addSound` の型を合わせる
3. `frontend/src/hooks/useAudioFileUpload.ts` — `onSuccess?: (id: string) => void` コールバック引数を追加
4. `frontend/src/components/Music/PlaylistDetail.tsx` — `useAudioFileUpload` フックを利用し、アップロード成功時にプレイリストに自動追加

---

## Issue 3: プレイリストに名前・タグ編集 + ゴミ箱→外すボタン

**修正ファイル**: `frontend/src/components/Music/PlaylistDetail.tsx`

---

## Issue 4/5/6: サウンド2カラムレイアウト + ボーダー + パネル別検索

**修正ファイル**: `frontend/src/components/WorkScreen/WorkMusicContent.tsx`

---

## Issue 7: PomodoroSettingsPanel ネスト button エラー

**修正ファイル**: `frontend/src/components/WorkScreen/PomodoroSettingsPanel.tsx`

---

## 実装順序

1. Issue 7 — PomodoroSettingsPanel (1箇所、最小変更)
2. Issue 1 — Calendar TaskPreviewPopup (1箇所)
3. Issue 2 — カスタムサウンド追加フロー (4ファイル)
4. Issue 3 — プレイリスト編集機能 (1ファイル、Issue 2の後)
5. Issue 4/5/6 — 2カラムレイアウト (1ファイル + i18n)
6. i18n — `en.json` / `ja.json` に新キー追加
7. README.md — 開発ジャーナル更新
