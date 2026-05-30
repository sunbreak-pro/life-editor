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
- **完了後の遷移**: ユーザー承認を経て Goal 3 へ
- **History**:
  - 2026-05-26 PENDING 起票

## Goal 3 — Desktop / Mobile UI 課題発見 + 改善実装

- **Status**: PENDING
- **完了条件**:
  - Desktop / Mobile 各プラットフォームの UI 課題 issue/plan 化
  - 段階的 UI 改善 PR の積み上げ（1 plan = 1 PR 単位）
  - `frontend-react-designer` スキル準拠（`notion-*` トークン / Pattern A / WAI-ARIA）
- **BLOCKED 遷移条件**: 設計判断が割れた箇所はユーザー承認待ちで一時 BLOCKED
- **History**:
  - 2026-05-26 PENDING 起票

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
