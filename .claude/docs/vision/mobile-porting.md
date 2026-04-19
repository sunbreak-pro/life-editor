# Mobile Porting Plan

> 次フェーズの主戦場。Desktop で完遂した読み書き体験を iOS に移植し、Cloud Sync で双方向連携する。

---

## 目的

iOS は **Consumption + Quick capture**、Desktop が **Primary creation**。
Desktop 側の Daily / Note / Schedule table の操作性をそのまま iOS に持ち込み、Cloud Sync で常時接続する。

## 3 本柱（主目的の読み書き対象）

| 柱       | 対象テーブル                                | 備考                                                       |
| -------- | ------------------------------------------- | ---------------------------------------------------------- |
| Daily    | `time_memos`                                | 日次メモ。Memo セクション                                  |
| Note     | `notes`                                     | TipTap リッチ。階層 + 接続                                 |
| Schedule | `schedule_items` / `routines` / `calendars` | Calendar + DayFlow + Routine の 3 分割（Desktop と同構成） |

既存 MCP 30 ツール（`list_notes` / `upsert_memo` / `list_schedule` 等）で主目的カバー済み → **新規 MCP 拡張は当面不要**。

## 範囲内（移植する）

- Tasks / Schedule / Notes / Memo の iOS UI 完成度向上
- Pomodoro Timer（Audio は skip、タイマー本体のみ）
- Cloud Sync（Desktop ↔ iOS 双方向、Cloudflare Workers + D1）

## 範囲外（Mobile 省略 Provider — coding-principles.md §4）

Audio / ScreenLock / FileExplorer / CalendarTags / WikiTag / ShortcutConfig

- 共有コンポーネントは Optional hook で `null` ガード必須
- Terminal + Claude Code + MCP Server は Desktop 専用（PTY 制約）

## 連携ハブ

- Cloudflare Workers + D1
- バージョンカラム + last-write-wins
- life-editor 全テーブル対象
- **Web UI は作らない**（CLAUDE.md §1 Non-Goals）

## 次のアクション（ドラフト、実装プランは別途）

1. iPhone シミュレータで Schedule / Work 新 UI の実機確認（MEMORY.md 予定済み）
2. Notes の iOS 編集体験検証（TipTap モバイル挙動・IME 対応）
3. Cloud Sync の Active Known Issue 解消
   - `sync_last_synced_at` 未保存
   - `tasks.updated_at` NULL on creation
4. 移植順ロードマップ策定（想定順: Daily → Note → Schedule → Database）

## 個別実装プランの運用

本ファイルは方針のみ。具体的な着手は `.claude/YYYY-MM-DD-<slug>.md` を作成し、本ファイルから相互リンクする（CLAUDE.md §9）。
