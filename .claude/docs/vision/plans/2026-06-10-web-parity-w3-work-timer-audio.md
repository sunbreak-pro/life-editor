---
Status: In Progress
Created: 2026-06-10
Branches: feat/w3-shortcut-executor (W3-0) / feat/w3a-timer-audio-foundation (W3-A) / W3-B, W3-C は A 完了後に起票
Owner-chat: main
Parent: ./2026-06-07-web-desktop-parity-roadmap.md
Previous: ../../../archive/2026-06-08-web-parity-w2-trash-palette.md
---

# Plan: W3 — Work / Timer / Audio 統合 + shortcut executor 配線

> 親ロードマップ `2026-06-07-web-desktop-parity-roadmap.md` の **W3**。web を Desktop 同等へ引き上げる横断レーンの3本目。
> **重大前提訂正（role-pm 調査 2026-06-10）**: ロードマップの「既存 `timer_sessions` / `pomodoro_presets`」は誤り。**Supabase に timer/sound 系テーブルは存在せず、DataService の該当メソッドは interface 宣言のみで SupabaseDataService 未実装（Proxy 未登録 = throw）**。DDL + DataService 実装をゼロから作る。

---

## Context

- **動機**: web に Work タブ / Pomodoro Timer / Audio Mixer が無い（旧 Desktop 同等化の主要残件）。W1 申し送りの shortcut 押下実行 executor も未配線。
- **確定済み設計判断（ユーザー回答 2026-06-10）**:
  1. **DB = 独立テーブル + 自前 updated_at**（items_meta 2行分割モデルに乗せない。timer/sound は user-scoped 設定/ログで role エンティティではない）
  2. **音源 = プリセット環境音6種のみ**（カスタム音源 save/load は W3 スコープ外。Supabase Storage 不要分は作らない）
  3. **音源配布 = Supabase Storage 公開バケット**（public/sounds/ はコミット禁止。バケット作成は 🛑 人手）
  4. **Pomodoro 計測 = 開始時刻ベース**（startedAt と現在時刻の差分で算出。setInterval throttle 非依存）
- **制約**: コスト $0 / frontend/ は参照のみ（FROZEN）/ 純粋部品規約（i18n props 注入・DataService DI）/ Pattern A / Audio・ShortcutConfig は Mobile 省略 Provider = Optional バリアント / notion-* トークン / AudioContext は suspended→ユーザー操作後 resume() 必須
- **Non-goals**: カスタム音源アップロード / Web Worker 計測 / 汎用 Database / frontend 側の変更 / プレイリスト高度編集（W3 は最小: ミックス保存程度。詳細は W3-C で確定）

---

## PR 分割（4 レーン）

| レーン   | 内容                                                              | 規模 | 依存                  | worktree / branch                                 |
| -------- | ----------------------------------------------------------------- | ---- | --------------------- | ------------------------------------------------- |
| **W3-0** | shortcut keydown executor 配線（web MainScreen）                  | S    | なし（並行可）        | w3-0-executor / feat/w3-shortcut-executor         |
| **W3-A** | DB migration 0018 + DataService 実装 + mapper + テスト（UI なし） | L    | なし（並行可）        | w3-a-foundation / feat/w3a-timer-audio-foundation |
| **W3-B** | TimerContext/Reducer 共有層化 + Pomodoro UI + Work タブ           | M-L  | W3-A merge 後         | 起票時に作成                                      |
| **W3-C** | Audio Mixer 共有層化（6種プリセット + Storage 配信）              | M    | W3-A merge 後         | 起票時に作成                                      |

- W3-0 と W3-A は領域分離（executor=MainScreen keydown / A=shared services + supabase）。**merge は W3-0 先行推奨**
- 本計画書は W3-A ブランチが運搬（W1/W2 と同方式）

---

## Scope (Touchable Paths)

```
W3-0: web/src/MainScreen.tsx（keydown 統合のみ）
      shared/src/utils/shortcutBinding.ts（event→KeyBinding 変換ヘルパー追記可）
      shared/src/hooks/（useGlobalShortcuts 新設可）
      shared/tests/
W3-A: supabase/migrations/0018_timer_audio_tables.sql（新規・push はユーザー）
      shared/src/types/（timer/sound 型の整理。既存 types/timer.ts types/sound.ts を v2 仕様へ）
      shared/src/services/（mapper 新設 + SupabaseTimerService 等 + SupabaseDataService Proxy 登録 + DataService interface 整理）
      shared/tests/
      .claude/docs/vision/plans/2026-06-10-web-parity-w3-work-timer-audio.md（本書）
```

**対象外**: frontend/（参照のみ）/ web/src/ の UI 追加（W3-B/C）/ 他チャット worktree / W1/W2 成果物の改変

---

## Steps

| #   | レーン | Step                                                                                                   | Gate    | Acceptance                                  |
| --- | ------ | ------------------------------------------------------------------------------------------------------ | ------- | ------------------------------------------- |
| 1   | W3-0   | event→KeyBinding 変換 + matchBinding ベースの executor フック（IME ガード + input/textarea/contentEditable ガード） | 🤖      | shared build/test 緑                        |
| 2   | W3-0   | MainScreen 配線: nav:* → setSection / global:command-palette → palette / global:settings → setSection("settings")。既存 Cmd+K 直書きリスナを executor に置換（デフォルト動作は不変）。new-task/undo/redo は対象ハンドラ未存在のため **no-op + TODO コメント**（W3-B/W4 で結線） | 🤖→👀  | rebind 済みキーで section 切替・palette 起動 |
| 3   | W3-A   | migration 0018: `pomodoro_presets` / `timer_sessions` / `sound_settings` / `playlists`（独立テーブル・user_id RLS・updated_at 自前・initplan cache 形式）。旧 SQLite DDL（src-tauri v2_v30.rs V12/V13/V15 + v61_plus.rs V66/V68）を参照に v2 設計 | 🤖      | SQL ファイル作成・lint（**push しない**）  |
| 4   | W3-A   | mapper + 単体テスト（W2 の roundtrip テスト方式）                                                       | 🤖      | vitest 緑                                   |
| 5   | W3-A   | SupabaseTimerService / SupabaseSoundService（または単一サービス）実装 + Proxy 登録 + DataService interface 整理（旧 Tauri 専用メソッドの扱いはコメントで明示） | 🤖      | shared build 緑                             |
| 6   | 🛑     | ユーザー: `supabase db push`（0018）+ Storage 公開バケット `sounds` 作成 + 音源6種アップロード         | 🛑 人手 | テーブル存在 + 公開 URL で音源取得可        |
| 7   | W3-B   | （A merge 後・別途詳細化）TimerContext/Reducer 共有層化（開始時刻ベース計算）+ Pomodoro UI + Work タブ + new-task/undo/redo executor 結線 | 🤖→👀  | Pomodoro 計測→timer_sessions 保存           |
| 8   | W3-C   | （A merge 後・別途詳細化）AudioProvider（Optional バリアント）+ ミキサー UI + Storage URL 再生         | 🤖→👀  | 環境音ミックス再生                          |

---

## Acceptance Criteria（機械検証可能・W3-0/A 分）

- [ ] `cd shared && npm run build` exit 0（両レーン）
- [ ] `cd shared && npm run test` 緑（既存 339 + 新規）
- [ ] `cd web && npm run build` exit 0 / `npm run lint` 0 errors（W3-0）
- [ ] migration 0018 が forward-only・idempotent ガード付き・RLS 4 policy + `(select auth.uid())` initplan 形式（W3-A）
- [ ] **目視（W3-0）**: デフォルト ⌘K でパレット / ⌘1-5 で section 切替 / ⌘, で settings / Settings で rebind したキーが即反映 / input 入力中に単キー shortcut が発火しない
- [ ] **🛑（W3-A 後）**: ユーザー db push + Storage バケット作成

---

## DB Migration Notes

**0018 新規（4 テーブル・独立モデル）**。`apply_migration` MCP 単独使用禁止 — **ローカルファイル先行 → ユーザー `supabase db push`**。Storage バケット作成（公開・`sounds`）も 🛑 人手。DDL 詳細（カラム設計）は W3-A engineer が旧 SQLite DDL を参照して v2 設計し、本書 Worklog に記録する。

---

## Risks / 留意点

1. **DataService interface の既存 Timer/Sound 宣言が旧 Tauri 仕様**（CustomSoundMeta 等カスタム音源前提を含む）— W3 スコープ（プリセットのみ）に合わせ、未実装メソッドは throw stub のまま温存 or interface 注記。**interface の破壊的変更は frontend が参照するため不可**（frontend は FROZEN だが build は生きている）→ 追加は可・変更/削除は不可
2. **AudioContext autoplay 制約**: suspended → ユーザー操作後 resume()（W3-C）
3. **worktree 検証**: node_modules symlink 設置済み。env 無し build の誤 tree-shake に注意（memory: worktree_supabase_treeshake）
4. **W3-0 と W1 ShortcutConfig の整合**: ShortcutConfigProvider は MainScreen 内（SyncProvider 直下）にマウント済み（#66）。executor はその内側で useShortcutConfig（Optional）を読む
5. **連続 squash merge の教訓（#66）**: W3-0 と W3-A が同一ファイルを触らないこと（領域分離済み）。merge 後は main で build 全数検証

---

## References

- 親: `2026-06-07-web-desktop-parity-roadmap.md` §W3 / 移行 SSOT `2026-05-04-cross-platform-migration.md`
- 旧 DDL: `src-tauri/src/db/migrations/v2_v30.rs`（V12 pomodoro_presets・timer_settings / V13 sound_settings / V15 playlists）+ `v61_plus.rs`（V66 label / V68 FREE session_type）
- Work 仕様: section-unification 棚卸し結論（History/Music/FREE 削除・TaskSelector 維持）+ `frontend/src/components/Work/`（参照のみ）
- 規約: CLAUDE.md §3.3（AudioContext）§6.2-6.4 / `docs/vision/coding-principles.md` §4（Optional Provider）§6（2層モデル）
- W1 成果: `shared/src/utils/shortcutBinding.ts`（matchBinding / bindingsEqual / bindingToDisplayString）・`shared/src/constants/defaultShortcuts.ts`（10 ID）

---

## Worklog

- 2026-06-10: role-pm 調査で前提訂正（テーブル不在・DataService 未実装）。ユーザー確認4点（独立テーブル / プリセットのみ / Storage 配信 / 開始時刻ベース）確定。W3-0 + W3-A worktree 作成・並列着手。
- 2026-06-10 (W3-A engineer): migration 0018 + mapper + service + Proxy 登録 + テスト実装。`cd shared && npm run build` exit 0 / `npm run test` 356 passed (baseline 339 + 17 新規)。

  **DDL 設計（0018_timer_audio_tables.sql — 6 テーブル）**

  旧 SQLite DDL（full_schema.rs base + v2_v30.rs V12/V13/V15 + v61_plus.rs V66/V68）を参照し、カスタム音源系を全落として v2 設計。判断理由は migration 冒頭コメントに記載。

  | テーブル | 主要カラム | id 戦略 | 旧 SQLite からの変更 |
  | --- | --- | --- | --- |
  | `timer_settings` | work/break/long_break_duration, sessions_before_long_break, auto_start_breaks, target_sessions | `smallint id check(id=1)` + PK `(user_id, id)`（per-user singleton） | base の `id CHECK(id=1)` を per-user singleton 化 |
  | `pomodoro_presets` | name, 4 duration 列 | `bigint generated always as identity` | V12 と同等（seed 行は入れない＝UI/ユーザーが作成） |
  | `timer_sessions` | task_id(no FK), session_type CHECK(WORK/BREAK/LONG_BREAK/FREE), started_at, ended_at, duration, completed, label | `bigint generated always as identity` | base+V66(label)+V68(FREE)。`completed_at` → `ended_at` に改名（開始時刻ベースモデル）。domain は `completedAt` 維持（mapper 橋渡し） |
  | `sound_settings` | sound_type, volume(0-100 CHECK), enabled | `bigint generated always as identity` + UNIQUE `(user_id, sound_type)` | V13 簡素版。`session_category` なし。プリセット6種のみ |
  | `playlists` | name, sort_order, repeat_mode CHECK(off/one/all), is_shuffle | `text id`（`playlist-<uuid>`） | V15 と同等 |
  | `playlist_items` | playlist_id(FK ON DELETE CASCADE), sound_id(no FK=preset enum), sort_order | `text id`（`pitem-<uuid>`） | V15 と同等。INSERT/UPDATE policy に parent playlist 所有 EXISTS 二重防衛追加 |

  **落としたもの**: `sound_presets`（ミックス保存）/ `sound_tags` + assignments / `sound_display_meta` / `sound_workscreen_selections` / custom_sounds blob。→ 該当 DataService メソッドは throw-stub のまま（Proxy 非登録）。

  **共通規約**: 全テーブル `user_id uuid not null default auth.uid()` / `created_at` / `updated_at`（singleton/log は自前 bump、items_meta 非依存）/ RLS 有効 + 4 policy を `(select auth.uid())` initplan 形式（0010/0015 流儀）/ idempotent ガード（create if not exists・drop policy if exists）/ realtime publication に 6 テーブル追加（0017 と同型ガード）。

  **DataService 対応方針**: 既存 interface の Timer/Sound/Playlist 宣言（旧 Tauri 仕様・`id: number`）を **シグネチャ変更なしでそのまま実装**。numeric id 維持のため DB を `bigint identity` に。実装 22 メソッド（Timer 11 + Audio 11）を `PHASE2_TIMER_METHODS` / `PHASE2_AUDIO_METHODS` で Proxy route 登録。未実装（スコープ外）= sound presets / sound tags / display meta / workscreen / custom sounds = 既存 throw-stub 温存。`timer.ts` / `sound.ts` / `playlist.ts` の既存 domain 型は破壊的変更なし（Row 型は mapper 内に新設）。
