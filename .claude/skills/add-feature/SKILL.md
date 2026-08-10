---
name: add-feature
description: E2E 機能追加ワークフロー。Use when adding a new feature that spans multiple layers (DB, IPC, frontend). Triggers include new feature, feature implementation, full-stack feature.
---

「add-featureを起動します」と表示する。

新機能をデータ層からUI層まで一貫して追加するワークフロー。
各フェーズの詳細は対応するスキルを参照。

## Phase 1: Data Layer

**データ永続化が必要な場合** → `/db-migration` スキルを参照

1. `electron/database/migrations.ts` にマイグレーション追加
2. `electron/database/` に Repository 作成
3. `electron/database/db.ts` で Repository 登録

## Phase 2: IPC Layer

**メインプロセスとの通信が必要な場合** → `/add-ipc-channel` スキルを参照

1. `electron/preload.ts` にチャンネル追加
2. `electron/ipc/` にハンドラ作成 + `registerAll.ts` に登録
3. `frontend/src/services/DataService.ts` にインターフェース追加
4. `frontend/src/services/ElectronDataService.ts` に実装追加

## Phase 3: Frontend

**UIコンポーネント作成** → `/add-component` スキルを参照

1. 型定義: `frontend/src/types/`
2. カスタムフック: `frontend/src/hooks/`
3. Context/Provider（必要な場合）: `frontend/src/context/`
4. UIコンポーネント: `frontend/src/components/`
5. `App.tsx` にセクション/表示ロジック追加
6. i18n: `frontend/src/i18n/locales/{en,ja}.json`

## Phase 4: Tests

**テスト作成** → `/test-writing` スキルを参照

1. `frontend/src/test/mockDataService.ts` に新メソッドのモック追加
2. Hook テスト
3. コンポーネントテスト
4. `cd frontend && npm run test` で全テスト通過確認

## Phase 5: 検証・仕上げ

1. `npm run dev` で動作確認
2. `cd frontend && npm run lint` で ESLint 通過
3. `/code-review` スキルでセルフレビュー
4. `README.md` に開発ジャーナルエントリ追加
5. `/git-workflow` スキルに従ってコミット

## ファイル変更の全体像

```
electron/database/migrations.ts      ← Phase 1: スキーマ
electron/database/*Repository.ts     ← Phase 1: データアクセス
electron/database/db.ts              ← Phase 1: Repository登録
electron/preload.ts                  ← Phase 2: チャンネル許可
electron/ipc/*Handlers.ts            ← Phase 2: ハンドラ
electron/ipc/registerAll.ts          ← Phase 2: ハンドラ登録
frontend/src/services/DataService.ts ← Phase 2: インターフェース
frontend/src/services/ElectronDataService.ts ← Phase 2: 実装
frontend/src/types/                  ← Phase 3: 型定義
frontend/src/hooks/                  ← Phase 3: ロジック
frontend/src/context/                ← Phase 3: 状態管理
frontend/src/components/             ← Phase 3: UI
frontend/src/i18n/locales/           ← Phase 3: 翻訳
frontend/src/test/mockDataService.ts ← Phase 4: モック更新
```
