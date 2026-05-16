# Vision: Cloud Sync リアルタイム化

> 状態: Draft / 2026-04-22 追加 / 実装プラン未作成

## Context

現状の Cloud Sync は **30 秒間隔の polling delta sync**(`frontend/src/context/SyncContext.tsx:19` `SYNC_INTERVAL_MS = 30_000`)。iOS で編集した内容が Desktop に反映されるまで最悪 60 秒近くかかる(片道 ~30s × 2)。体感上「同一 DB を共有している実感」が薄く、リアルタイム編集系の操作で違和感が出る。

## Why 変えるか

- **N=1 用途のストレス**: 作者本人が iPhone / Mac 両端で同じノートを触る際、保存後に相手端末に反映されるまでの体感ラグが作業フローの中断になる
- **同期中の一時的な不整合**: 30 秒間隔のため、片方で編集中に他方で編集すると LWW で片方が破棄される window が長い
- **現状の 30 秒サイクルは polling ベース設計初期のデフォルト**。根拠のある数字ではなく、単に保守側(battery / CF Workers request 枠)を優先した初期値

## Non-Goals

- CRDT ベース真リアルタイム共同編集(作者のみ利用の N=1 では過剰)
- Web UI や他ユーザーへのリアルタイム通知(vision §1 Non-Goals に沿う)

## 方針(概観のみ、詳細は plans/ 配下で設計)

### Phase 1 — Foreground 可変 polling + 変更イベント駆動 push(軽量・低コスト)

- `document.visibilityState` を観測し、フォアグラウンド中は **3〜5 秒間隔**、背景時は **60 秒間隔** に切替
- 主要 mutation(`updateNote` / `upsertMemo` / `createScheduleItem` 等)呼び出し後に **debounced `triggerSync()`** を発火(500〜1000ms 内の連続編集は 1 sync にまとめる)
- CF Workers の request 枠消費は Phase 1 で 3〜6 倍程度の増加を許容範囲と見る

体感目標: 編集 → 相手端末で 2〜5 秒以内に反映。

### Phase 2 — Server push(CF Durable Objects / WebSocket)

- Phase 1 でまだ遅延が気になる場合のみ着手
- CF Workers + Durable Objects で各デバイス接続を保持し、他デバイスからの push 受信時に該当デバイスへ通知
- フロント側は WebSocket で受信→即時 pull

Phase 2 は実装量大かつ CF Free 枠超過の可能性があるため、Phase 1 の体感で十分なら着手不要。

## 現状とのギャップ詳細

| 項目                    | 現状      | Phase 1 目標                             | Phase 2 目標                          |
| ----------------------- | --------- | ---------------------------------------- | ------------------------------------- |
| 片道 latency(最悪)      | 30s       | 3〜5s                                    | <1s                                   |
| 往復 latency(最悪)      | 60s       | 6〜10s                                   | <2s                                   |
| CF Workers request 頻度 | 2/分/端末 | 10〜20/分/端末                           | イベント駆動                          |
| 実装規模                | —         | `SyncContext.tsx` + 主要 mutation 呼出層 | Durable Objects 導入 + WebSocket 基盤 |

## 関連

- `frontend/src/context/SyncContext.tsx` — polling 実装の中核
- `src-tauri/src/commands/sync_commands.rs` — sync_trigger / sync_full_download
- `cloud/src/routes/sync.ts` — Cloud 側 push/pull エンドポイント
- `.claude/docs/known-issues/011-schedule-items-routine-date-duplication.md` — 同期設計見直しの切っ掛けとなった事例

## Next Steps(実装プラン作成時)

- `docs/vision/plans/YYYY-MM-DD-realtime-sync-phase1.md` に Steps / Files / Verification を具体化
- Phase 1 完了後、体感で Phase 2 必要性を判断
