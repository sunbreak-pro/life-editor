# Decision Queue — chat-refactor-core

## D-20260810-refactor-1: ルーチンの Undo/Redo を繋ぐか、コードを消すか

**背景**: 2026-08-10 のリファクタ調査で判明。`RoutineProvider` だけが UndoRedo に接続されていない（`ScheduleItemsContext` / `DailiesUnifiedContext` / `NotesUnifiedContext` には `useUndoRedoOptional()` の自動接続がある）。そのため `useRoutinesAPI` の undo/redo 用コード約 60 行は**実行されても何も起きない空撃ち**になっている。加えて `createNoopUndoRedo()` をレンダー本文で毎回呼ぶため、RoutineContext の値が毎レンダー変わっている。

Issue #672（use\*API の load effect 共通化）で同じファイル群を触るが、「ルーチンの Ctrl+Z を機能として出すか」は挙動の追加なので P-008 に従い実装せずここへ積む。

**A: 繋ぐ + i18n ラベルを 3 件足す**。`useUndoRedoOptional()` を `RoutineContext` にも配線し、`undoRedo.labels` に `createRoutine` / `updateRoutine` / `deleteRoutine` を en・ja 両方へ追加する。

- 利点: 既に書かれている約 60 行が機能する。他 4 ドメインと挙動が揃う（ルーチンの作成・更新・削除を Ctrl+Z で戻せる）
- 欠点: 挙動の追加なので「挙動変更ゼロ」の原則から外れる。繰り返し系の undo は生成済み Event との整合を確認する必要があり、実ブラウザ確認が要る
- **ラベル追加は必須**: 繋いだだけだと `en.json` / `ja.json` に routine 系のラベルが無いため「Undid: createRoutine」という生キーの toast が出る

**B: 空撃ちコードを消す**。`useRoutinesAPI` の push ブロック約 74 行を削除する。

- 利点: 純減。誰も使っていないコードが消え、読む人が「なぜ効かないのか」で悩まなくなる
- 欠点: 後で欲しくなったら書き直し

**C: 現状維持**。コメントで「未接続」と明記するだけ。

- 利点: 何も壊れない
- 欠点: 空撃ちコードが残り続ける

**放置時**: C（現状維持）。#672 では触らず、コメントだけ足して進める。
