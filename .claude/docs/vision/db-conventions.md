# DB Conventions — Life Editor

> SQLite + Cloud D1 + Sync Engine にまたがる DB 操作の規約集。設計原則（なぜ）と遵守ルール（どう書くか）の両方を保持する。
> 実装コードの規約部分（どう書くか）は CLAUDE.md §4, §7 の SSOT 章からもリンクされる。

---

## 0. 背景

Life Editor は Desktop SQLite (rusqlite) と Cloud D1 (Cloudflare Workers) の両方に同じテーブル構造を持ち、さらに MCP Server (better-sqlite3 / Node.js) が同じ Desktop DB を直接参照する多言語多ランタイム構成。同じ DB に対する write の経路が Rust / TypeScript (MCP) / TypeScript (Cloud) の 3 つあり、timestamp / UPSERT / 制約の扱いがすべて揃っている必要がある。

過去発生した障害（Known Issues 001/002/004/005/008/011/012/013/014）の 60% は DB 周辺。うち半数は「複数層で書き込み規約が揃っていなかった」系統。本規約はその再発防止を目的とする。

---

## 1. Timestamp の canonical form

### ルール

- **全ての `created_at` / `updated_at` / `deleted_at` は ISO 8601 UTC with milliseconds (`YYYY-MM-DDTHH:MM:SS.fffZ`) で書く**
- 例: `2026-04-23T12:42:12.496Z`
- **SQL 内の `datetime('now')` / `CURRENT_TIMESTAMP` は禁止**（`YYYY-MM-DD HH:MM:SS` 形式を返すため混在が起きる）

### なぜ

- 文字列としてソート可能（T > space の ASCII 順のため混ぜると比較が壊れる、Known Issue 013 で実証済み）
- UTC 固定で timezone 曖昧さがない
- ミリ秒まで含むので同秒内の連続 write を区別できる（Routine 生成のバッチ等）
- `Date.parse()` / `chrono::DateTime::parse_from_rfc3339` が完全対応

### 実装

| 言語              | 使うもの                    | 禁止                                                                                                                        |
| ----------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Rust              | `crate::db::helpers::now()` | `datetime('now')`（SQL 内）/ `chrono::Utc::now().to_rfc3339()`（`+00:00` オフセット形式になる、3 つめの形式を作ってしまう） |
| MCP Server (TS)   | `new Date().toISOString()`  | `datetime('now')`（SQL 内）/ SQLite の built-in time function                                                               |
| Cloud Worker (TS) | `new Date().toISOString()`  | 同上。ただし Cloud は client の timestamp を信じる（push 時）ので原則書かない                                               |
| Frontend          | Rust/MCP 経由でのみ書く     | Frontend が直接 SQL を書くことはない                                                                                        |

### ヘルパ定義

- Rust: `src-tauri/src/db/helpers.rs:156` `pub fn now() -> String { chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string() }`
- MCP / Cloud: 言語標準の `new Date().toISOString()`（両者同一形式）

### 既存違反箇所（2026-04-23 時点、未修正）

`src-tauri/src/db/helpers.rs:8, 18, 56` の `soft_delete_by_key` / `restore_by_key` が SQL 内で `datetime('now')` を使用している。これが 013 の発生源。別 session でヘルパ関数に ISO 8601 文字列を param 渡しする形に修正予定。

`src-tauri/src/db/daily_repository.rs:71` / `app_settings_repository.rs:15` も同様。

MCP Server 側は `contentHandlers.ts` / `noteHandlers.ts` の INSERT / UPDATE で `datetime('now')` 使用。

### 比較の書き方（暫定対応中）

既存データに space 形式が残っているため、sync の delta query では `datetime()` で正規化する:

```sql
WHERE datetime(updated_at) > datetime(?)
```

全ての write を ISO 化し空間形式データを backfill した後、`datetime()` wrap は外す（index 効率のため）。

---

## 2. `updated_at` / `version` の役割分担

### ルール

- **`updated_at`**: その行の content が最後に変更された時刻（=編集時刻）
- **`version`**: 編集回数のモノトニックなカウンタ。**書き込みのたびに必ず +1**
- **LWW 比較**: sync の UPSERT では `excluded.version > current.version` のみで判定。timestamp は参考値として保存するが衝突判定には使わない

### なぜ

- N デバイス環境ではローカル時計が同期していないため、`updated_at` 単独での LWW は信頼できない
- `version` はデバイス毎に local increment される単調な値。衝突時は高い方を勝たせる単純ルールで成立する
- ただし `version` も 2 デバイスが独立編集するとゴースト bump する（A v=10 / B v=10 → A 編集 v=11、B 編集 v=11 → いずれの push も `11 > 10` で通るが後勝ち）。これは許容する割り切り

### 違反パターン

- 編集時に `updated_at` は更新するが `version` を bump し忘れる Repository メソッド
- UPDATE が `version` を触らず、外側の caller 責務にしている設計
- Frontend が `updated_at` を決めて渡すが `version` は渡さない

すべて Repository 内で `version = version + 1, updated_at = ?` のペアで更新すること（外部任せにしない）。

---

## 3. 同期プロトコルの制約

### delta sync cursor は `server_updated_at`（2026-04-24 から）

`/sync/changes` は **Cloud D1 側が stamp する `server_updated_at` を cursor に使う**。client の content `updated_at` は UI / ソート用途に残すが、sync cursor としては使わない。

- `server_updated_at` は Worker `/sync/push` が受信のたびに **`serverNow = new Date().toISOString()` で必ず上書き**する
- version LWW で UPDATE が棄却された場合でも、2 文構成（UPSERT 直後に `UPDATE ... SET server_updated_at = ?serverNow WHERE <pk>`）で stamp は必ず進む
- delta query: `SELECT * FROM <table> WHERE datetime(server_updated_at) > datetime(?since) ORDER BY datetime(server_updated_at) ASC`

### この設計が必要だった理由（Known Issue 014）

以前の `WHERE updated_at > since` は **updated_at が全デバイス横断で単調増加する前提** に立っており、以下で破綻した:

- Mobile が古い時刻（11:50）で大量 write → v=372 を Cloud に push
- Desktop が新しい時刻（13:30）で 1 回 write → v=228 を Cloud に push
- Cloud は version 比較で Mobile が勝ち、row は v=372, updated_at=11:50 で固定
- Desktop の次回 pull の since=13:31 は Cloud row の 11:50 より新しい → **永久に pull されない**

`datetime()` 正規化（Issue 013）を適用しても解消しない別層の問題。server_updated_at は「棄却された push」でも進むため、「Desktop が自分の push を棄却されたあとの次回 pull」で Cloud の最新 row（v=372）が降ってくるようになる。

### 運用ルール

1. **push 時の server_updated_at stamp は落とさない**
   - 新しいテーブルを versioned に追加したら、`/sync/push` の stamp ロジックに必ず含める
   - relation-with-updated_at テーブルも同様
   - `ON CONFLICT DO UPDATE ... WHERE excluded.version > ...` は WHERE が false のとき UPDATE 丸ごとスキップするので、2 文方式を崩さない

2. **Full Re-sync は緊急弁として常に用意する**
   - Desktop SyncSettings に Full Re-sync ボタン存在 ✓
   - Mobile Settings にも Full Re-sync ボタンを追加する（MEMORY.md 予定）
   - server_updated_at 導入後も「Cloud と client の cursor がどこかで乖離した」時のための保険として残す

3. **sync の健全性チェック**は「両端の COUNT 一致」ではなく「両端の (id, version) セット一致」で判定する:

   ```sql
   -- 両端で差分検査
   SELECT id, version FROM notes WHERE is_deleted=0 ORDER BY id
   ```

   これを diff して完全一致すれば OK。

4. **新規 relation テーブル追加時の server_updated_at backfill に注意**
   - ALTER TABLE ADD COLUMN + `UPDATE SET server_updated_at = updated_at` で backfill すると、元々 `updated_at` が NULL だった行は NULL のまま残る
   - NULL 行は delta query の datetime 比較で false となり pull から漏れる
   - 追加の `UPDATE ... SET server_updated_at = '1970-01-01T00:00:00.000Z' WHERE server_updated_at IS NULL` を必ず続けること

### 関連制約（Known Issue 012）

- `/sync/changes` は `LIMIT=5000`（暫定引き上げ済み）。超えると `hasMore: true` が返るが client は現状無視 → 永久 pull されない
- 対策: client 側 pagination loop 実装。Worker 側に `nextSince` cursor を返させる

---

## 4. UPSERT / 衝突解決

### versioned tables のルール

```sql
INSERT INTO notes (...) VALUES (...)
ON CONFLICT(id) DO UPDATE SET ...
WHERE excluded.version > notes.version OR notes.version IS NULL
```

- PK は `id` 単独
- 衝突時は version 大きい方が勝ち（LWW）
- NULL 処理: 既存レコードが何らかの理由で version=NULL になっているケースに備えて `OR notes.version IS NULL` を入れる（初期化失敗対策）

### 論理一意性を持つテーブルは複合キーで特別扱い

`schedule_items (routine_id, date)` のように「別 id でも同じ論理行」があるテーブルは、UPSERT だけでは衝突を検知できず（異 id → INSERT が通る → Cloud に重複蓄積）。以下の対策を併用:

- DB 側 partial UNIQUE index（`WHERE routine_id IS NOT NULL AND is_deleted = 0`）
- Rust `sync_engine::upsert_versioned` で該当テーブルを特別扱い（異 id 同 (routine_id, date) をスキップ）
- Cloud Worker push handler で pre-dedup（異 id をフィルタ）

詳細は Known Issue 011 参照。**新規の論理一意テーブルを追加する場合は必ず同様の 3 点セットを入れる**。

### relation tables（updated_at なし）

`calendar_tag_assignments` 等は複合 PK のみで updated_at を持たない。delta sync 時は親テーブル（`schedule_items` 等）の updated_at でフィルタして引き出す:

```sql
SELECT cta.* FROM calendar_tag_assignments cta
 INNER JOIN schedule_items si ON cta.schedule_item_id = si.id
 WHERE datetime(si.updated_at) > datetime(?)
```

親が更新されない限り関連 tag も同期されないため、tag だけ変えた場合は親 `updated_at` も bump すること。Repository の `tag_entity` メソッド等で両方 UPDATE する責務を持たせる。

---

## 5. マイグレーション

### Desktop 側（rusqlite, migrations.rs）

- 正本: `src-tauri/src/db/migrations.rs`
- `user_version` を必ずインクリメント
- `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN` は idempotent 想定
- データ変換を伴う ALTER（RENAME COLUMN 等）は `has_table()` / `has_column()` ヘルパで冪等化
- 既存マイグレーションの編集禁止。必ず末尾に新しいバージョンブロックを追加

### Cloud D1 側（wrangler）

- 正本: `cloud/db/schema.sql`（新規プロビジョン用）+ `cloud/db/migrations/NNNN_<name>.sql`（既存 DB に当てる用）
- **CI で自動実行されない**。`wrangler d1 execute <DB> --remote --file=...` を手動実行
- **Desktop のマイグレーションファイルをそのまま流用してはいけない** — Cloud schema は Desktop 側の一部サブセット（`note_links` / `paper_nodes` 等は Cloud には無い）。013 解決時に migration 0002 を作り直した経緯を参照
- wrangler の `--file=` 相対パスは CWD 基準。`cd cloud && wrangler d1 execute ... --file=db/migrations/0002...sql` の形に固定
- D1 に流す前に **ローカルで `--local` でドライ実行** することを習慣化

### 3 点同期（Desktop ↔ Cloud ↔ Mobile の協調）

スキーマ変更は **3 つの協調が必要**:

1. Desktop Rust バイナリを新しい migration 込みで再ビルド → 実機にインストール
2. Cloud D1 に migration 適用
3. Mobile iOS バイナリを再ビルド → 実機にインストール

**順序**: 通常「1 → 2 → 3」が安全だが、schema が drop / rename を含む場合は Cloud を先に当てると読み取り不能期間が発生する。その場合は「new schema を先に add（compat 期間）→ clients 更新 → old schema を drop」の 3 段階で行う。

現状 V64 のように「急進的 rename + drop」を 1 段階で行うとタイミング事故（Known Issue 013 の発火原因）になるので次回以降は避けるのが望ましい。

### D1 の SQL 制約

- D1 は `SQLITE_LIMIT_COMPOUND_SELECT=5`（`UNION ALL` を 6 本以上繋ぐと `too many terms` エラー）
- D1 `wrangler d1 execute --file=` で複数 statement を流すと結果行は表示されず summary のみ → `--json` 付加で行取得、または `--command` で 1 本ずつ実行
- `SQLITE_LIMIT_SQL_LENGTH` も緩めに設定されているが、安全側で 100KB 以下を目安に

---

## 6. Multi-language write の規約

同じテーブルを Rust / MCP / Cloud の 3 言語から触る以上、以下を揃える:

- **column 順序に依存しない**: INSERT は必ず `INSERT INTO t (col1, col2, ...) VALUES (...)` で列名明記
- **timestamp / version** は §1 §2 に従う
- **NULL 扱い**: `DEFAULT NULL` vs `DEFAULT ''` を各列で決めて一貫させる（MCP 側は `null` を送るが Rust 側が空文字列期待だったケースで過去バグ）
- **冪等な UPSERT**: 全 writer が `ON CONFLICT(id) DO UPDATE SET ...` を使う（MCP が `INSERT OR REPLACE` を使うと version チェックがバイパスされ LWW 崩壊）

### Schema 同期の監視

次のコマンドで Desktop と Cloud のスキーマ差分を目視できる。CI 化の余地あり:

```bash
# Desktop
sqlite3 ~/Library/Application\ Support/life-editor/life-editor.db ".schema notes"

# Cloud
cd cloud && npx wrangler d1 execute life-editor-sync --remote --command="SELECT sql FROM sqlite_master WHERE tbl_name='notes'"
```

---

## 7. 禁止事項サマリ

| ❌ 禁止                                    | ✅ 代わりに                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| SQL 内の `datetime('now')`                 | `helpers::now()` / `new Date().toISOString()` を param 渡し                 |
| `CURRENT_TIMESTAMP`                        | 同上                                                                        |
| `chrono::Utc::now().to_rfc3339()`          | `helpers::now()`（format 固定のため）                                       |
| `INSERT OR REPLACE` on versioned tables    | `INSERT ... ON CONFLICT(id) DO UPDATE SET ... WHERE excluded.version > ...` |
| version を bump しない UPDATE              | 必ず `version = version + 1` を含める                                       |
| Desktop migration を Cloud にそのまま流用  | Cloud 向けに対象テーブルを絞る                                              |
| 複数 UNION ALL（D1 は 5 本まで）           | 個別 SELECT で実行                                                          |
| wrangler deploy 後に D1 migration を忘れる | deploy と migration を対のセットとして扱う                                  |
| updated_at 単独で sync の完全性判定        | `(id, version)` セット一致で判定                                            |

---

## 8. 関連ドキュメント

- `.claude/docs/known-issues/001-*` 〜 `014-*` — 全 DB / sync 系バグの Root Cause
- `.claude/docs/vision/realtime-sync.md` — sync の次フェーズ設計
- `.claude/docs/vision/mobile-porting.md` — Mobile 側の sync 要件
- `CLAUDE.md §4` — Data Model（schema 概要）
- `CLAUDE.md §7.2-7.3` — IPC / migration の実装手順
- `src-tauri/src/db/helpers.rs` — Rust 側 DB ヘルパ実装

---

## 9. 今後の作業（別セッション候補）

優先度順:

1. **timestamp 統一 (013 根本対応)**: `datetime('now')` 使用箇所を全てヘルパ経由に置換。既存 space 形式データを `UPDATE ... SET updated_at = replace(replace(updated_at, ' ', 'T'), ...)` でバックフィル
2. **Mobile Full Re-sync ボタン追加**: 緊急弁を Mobile にも
3. **Sync pagination 本命実装 (012)**: `nextSince` cursor + client loop
4. **Schema drift CI チェック**: Desktop migrations.rs と cloud/db/schema.sql の乖離を PR で検出

### 完了済み（履歴）

- **server_updated_at 導入 (014 本命対応)** — 2026-04-24 完了。Cloud D1 に列追加、Worker `/sync/push` 2 文方式で stamp、`/sync/changes` を cursor 切替。詳細は `known-issues/014-*.md`
