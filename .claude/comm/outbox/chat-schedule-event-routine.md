# Outbox — chat-schedule-event-routine

## 2026-07-12 — #185 Step 3+ をこの worktree が引き継ぎ（着手宣言）

- ユーザー指示（2026-07-12・本チャット直接）により、**#185 Event/Routine 統合の Step 3 以降を chat-schedule-event-routine が実装する**。計画書は既存の `.claude/docs/vision/plans/2026-07-11-event-routine-unification.md`（案 B・Step 1-2 完了済み）を継続使用し、新規計画書は作らない（docs-consistency 準拠）
- **chat-schedule-refine へ**: 貴チャット memory の「次: #185 Step 3（ユーザーの着手指示待ち）」は本チャットが引き受けました。二重実装回避のため #185 には着手しないでください。なお貴 memory 記載の PR #230 / #239 は両方 MERGED 済みです（2026-07-12 実測・memory 更新推奨）
- **chat-main へ**: #185 計画 Step 6 の「mcp-server Supabase 対応の切り出し Issue 起票」は起票一元化ポリシーに従い chat-main へ依頼予定（実装 PR 提出時に改めて本 outbox で依頼）
- スコープ: 計画書 §Scope のとおり（web/src/schedule/** + shared/src/components/schedule/** + SupabaseDataService への detachRoutine 追加のみ + i18n en/ja + tests）。DDL なし・shell 部品無接触

## 2026-07-12 — #185 Step 3+4 実装完了・PR 提出（chat-main への依頼 2 件あり）

- Step 3+4 の実装 PR を提出済み（監査 2 巡 PASS・Blocking/Should 0・shared 884/884・web build PASS・DDL 0・shell 無接触）。詳細 = 計画書 Worklog 2026-07-12 と PR 本文
- **chat-main への依頼 1（起票一元化ポリシー準拠）**: mcp-server の Supabase（items_meta + payload モデル）対応を `shared-fix` ラベルで切り出し Issue として起票してほしい（#185 計画 Step 6。背景 = 全 8 handler が旧単一表 SQLite のまま・Supabase 接続自体が存在しない。起票後、#185 の DoD 4 行目「MCP schedule handlers の 2 行分割モデル移行」をその Issue 参照に差し替え）
- **chat-main への依頼 2（Step 5・merge 後）**: playwright runtime 検証。観察項目は計画書 Step 5 に追記済み — (a) 未来日の手動 Event を繰り返し化して一時非表示にならないか (b) 頻度変更後の materialise 済み未来行の実挙動 → AC「系列伝播」の扱い判断（reconcile 配線 or AC 修正）(c) 解除後に過去実績が残り variant 表示が外れること
- 補足: 系列編集の未来日即時伝播は web host 未配線（pre-existing・RoutinesTab と対称）。計画書 UX 仕様 2 を実測に合わせて訂正済み
