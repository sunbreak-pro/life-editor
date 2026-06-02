# Routine Goal Roadmap (SSOT)

> 夜 Routine は本ファイルを読み取り専用で参照、朝 Routine が状態を更新する。
> ユーザーは手動編集してよい（Goal の追加 / 優先順位入れ替え / 完了条件の調整）。
> 状態遷移時は必ず `Last-Updated` と `History` を更新する。

---

## Active Goal

**Current**: `Goal 1`
**Last-Updated**: 2026-05-26
**Updated-By**: chat-main (initial)

---

## Goal 1 — Mobile アプリ本番環境移行の準備

- **Status**: ACTIVE
- **完了条件**（全て満たした時点で DONE）:
  - Capacitor iOS / Android の本番 build 経路が CLI から再現可能に整備済
  - 署名・配布フローの **手順** が `docs/` に文書化済（実証明書投入は不要、手順記述のみ）
  - GitHub Actions workflow ファイル（`.github/workflows/mobile-*.yml`）が作成済 + `act` または `gh workflow view` で **構文 valid** が確認済 + secrets 投入なしで実行可能な dry-run（lint / build-only）が pass
  - **実装本体（リリース）は対象外、準備のみ**
  - 「secrets を実際に投入するステップ」は workflow 内に存在しても可（ジョブが skipped になればよい）
- **BLOCKED 遷移条件**: 以下のいずれかに到達したら BLOCKED → Goal 2 に自動遷移
  - Apple Developer Program 登録が必要
  - 証明書・プロビジョニングプロファイル発行が必要
  - キーチェーンへのシークレット投入が必要
  - Google Play Console アカウント作成が必要
  - その他「ユーザーの手」が物理的に必要な項目
- **参照**: `.claude/2026-05-04-cross-platform-migration.md` Phase 5 関連
- **History**:
  - 2026-05-26 ACTIVE 起票（初期）

## Goal 2 — コード健全性監査 + リファクタリング計画書群作成

- **Status**: PENDING
- **完了条件**:
  - 重複コード調査レポート → `.claude/docs/vision/plans/` に計画書化
  - 脆弱性（型安全性 / 入力検証 / 認可 / Sync 整合性）調査レポート → 計画書化
  - 拡張性課題（DataService 抽象 / Provider 順序 / 結合度）調査レポート → 計画書化
  - **個別リファクタの実装は対象外、計画書化までで止める**
- **BLOCKED 遷移条件**: 監査の過程で**破壊的変更（既存機能を壊す可能性のあるリファクタ）が必須**と判明したらユーザー承認待ちで BLOCKED → Goal 3 へ自動遷移。例: DataService の interface 変更で既存 Provider 全書き直しが必要 / Sync スキーマの後方非互換変更が必要、等
- **完了後の遷移**: ユーザー承認を経て Goal 3 へ
- **History**:
  - 2026-05-26 PENDING 起票
  - 2026-05-31 BLOCKED 遷移条件追記（破壊的変更必須を検知したら自動 BLOCKED → Goal 3）

## Goal 3 — Desktop / Mobile UI 課題発見 + 改善実装

- **Status**: PENDING
- **完了条件**:
  - Desktop / Mobile 各プラットフォームの UI 課題 issue/plan 化
  - 段階的 UI 改善 PR の積み上げ（1 plan = 1 PR 単位）
  - `frontend-react-designer` スキル準拠（`notion-*` トークン / Pattern A / WAI-ARIA）
- **BLOCKED 遷移条件**: 設計判断が割れた箇所はユーザー承認待ちで一時 BLOCKED → 次 Goal が存在しないため `Terminal State Handling` に従って idle 化
- **完了後の遷移**: Goal 3 が最後の Goal。DONE / BLOCKED 時は `Terminal State Handling` に従う
- **History**:
  - 2026-05-26 PENDING 起票
  - 2026-05-31 終端処理を Terminal State Handling 章へ委譲

---

## Goal 遷移ログ（朝 Routine が追記）

| 日時 | 旧 Goal | 新 Goal | 理由             |
| ---- | ------- | ------- | ---------------- |
| —    | —       | Goal 1  | 初期セットアップ |

---

## 運用メモ

- Goal は 1 つしか ACTIVE にしない（夜 Routine が混乱するため）
- BLOCKED は「人手介入待ち」を意味する。自動では戻らない（ユーザーが ACTIVE / DONE を手動更新）
- 新規 Goal 追加時は完了条件と BLOCKED 遷移条件を明示すること
- 各 Goal 完了時は `.claude/history/chat-main.md` にサマリを 1 行記録

---

## Terminal State Handling（全 Goal 終端時の挙動）

最後の Goal が DONE / BLOCKED に到達し、次の PENDING Goal が存在しない場合の Routine 挙動。

### 状態遷移

- 夜 Routine が「次 PENDING Goal なし」を検知したら `Active Goal` セクションを以下に書き換える:
  ```markdown
  **Current**: `(idle)`
  **Last-Updated**: <YYYY-MM-DD>
  **Updated-By**: chat-auto-<...> (terminal-state)
  ```

### Idle モードでの夜 Routine 挙動

`Current: (idle)` を検出した夜 Routine は以下の制限付き動作に切り替わる:

- **実装ループ進入禁止**: iteration loop (Step 3) には入らない
- **plan 起票のみ続行**: 最後の Goal にゆるく紐付く（あるいは独立な）改善 plan を 1 件、`.claude/docs/vision/plans/` に起票するだけで終了
- **commit/push しない**: plan ファイルは worktree 内に残して draft PR 化しない（ユーザーが朝レビューしてから本登録 → 新 Goal 化）
- **outbox 報告必須**: `night-report.md` に `Result: Idle (terminal state, plan draft only)` を記録

### Idle 復帰条件

ユーザーが goals.md を手動編集して以下のいずれかを実行:

1. 新 Goal を追加し `Active Goal` セクションを `Current: Goal N` に書き換える
2. 既存 BLOCKED Goal を `Status: ACTIVE` に戻し `Active Goal` セクションを更新
3. 既存 DONE Goal を再 Open（稀ケース。`Status: ACTIVE` + 完了条件改訂）

復帰後は通常運用に戻る（次夜 Routine から実装ループ再開）。

### Idle 化を避けたい場合

- ユーザーは Goal 3 完了が見えてきた段階で Goal 4 / 5 を手動追加することを推奨
- 朝 Routine（後追い登録予定）が「次 Goal なし」を検出した時点で outbox 警告を出す
