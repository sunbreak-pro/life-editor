# Core Vision

> CLAUDE.md §1-5 の詳細版。Core Identity / Target User / Value Propositions / Non-Goals / Platform Strategy。
> **素案（Phase A-2）— ユーザーレビュー待ち**

---

## 1. Core Identity

### 1-line definition

**「AI と会話しながら生活を設計・記録・運用するパーソナル OS」**

### Elevator pitch

カレンダー中心の AI 連携ワークスペース。タスク・スケジュール・メモ・知識・家計などを一つのデスクトップアプリに集約し、アプリ内ターミナルから Claude Code が MCP Server 経由で全データを自然言語で操作する。SQLite ローカル SSOT + Cloud Sync で Desktop ↔ iOS 間を同期しつつ、オフラインでも完全動作する。

### 意図的に外したもの

- **チームコラボレーション**: 個人利用前提。共有・コメント・権限管理は持たない
- **Web UI**: Desktop / iOS のネイティブクライアントのみ提供
- **特定用途特化アプリ**: 家計簿専用 / レシピ管理専用などのスペシャライズドアプリではない。Notion 的な汎用 DB で表現する
- **Claude API 直接課金**: Max サブスクリプションの Claude Code ラッピング方式で AI コスト $0 を維持

---

## 2. Target User

### Primary user

**作者本人（N=1）— 平日は macOS、週末は iOS、Claude Code を日常的に使う開発者**

### Key characteristics

- 自分の生活データ（タスク / スケジュール / メモ / 学習記録 / 家計）を一つの SQLite に集約したい
- 自然言語（Claude Code）でデータ操作することに慣れている、ターミナルを日常的に使う
- Notion / Obsidian / Apple Reminders / Google Calendar のいずれも単独では満足できない（複数併用の手間が課題）
- 集中作業時に環境音 + ポモドーロタイマーを使う没入型ワークフロー
- 開発者 = 必要なら自分で機能追加できる、ドキュメンテーション・規約への許容度が高い

### Non-users

- 複数人で共有するチーム / 組織
- 紙ベースの記録を好む人
- Web ブラウザでのみアプリを使いたい人
- 「設定不要・即使える」を重視する一般ユーザー（本アプリは設計に意図と知識を要する）

---

## 3. Core Value Propositions

### V1: AI が自然言語で全データを操作できる（追加コスト $0）

- **根拠**: MCP Server（30 ツール）+ アプリ内ターミナル（portable-pty）+ Claude Code Max サブスクのラッピング方式（ADR-0005）
- **比較**: Notion AI は UI 経由のみで内製 AI、Obsidian の AI プラグインは外部 API キー必須、Apple Reminders には AI なし

### V2: ローカル SQLite が SSOT — オフライン完全動作 + マルチデバイス同期

- **根拠**: rusqlite (WAL) + Tauri 2.0 + Cloud Sync（Cloudflare Workers + D1, 設計中）
- **比較**: Notion はクラウド必須でオフライン制限、Obsidian は同期が Sync プラン（有料）か自前運用、Apple Reminders は Apple エコシステム外と連携困難

### V3: Notion 的汎用 DB + 特化機能の両立

- **根拠**: Tasks / Schedule / Notes / Memo は特化テーブル（CRUD 高速、ドメイン制約あり）、家計簿・読書記録・習慣トラッカーなどは汎用 Database で表現
- **比較**: Notion は全部汎用 DB（タスク特化機能が弱い、リマインダー・タイマー・ルーチンが二級市民）、Apple Reminders / TickTick は特化のみで汎用 DB なし

---

## 4. Non-Goals

- **NG-1: マルチテナント / チームコラボ機能は持たない**（個人利用前提、共有・権限・コメントなし）
- **NG-2: Web UI は提供しない**（Desktop / iOS のネイティブのみ。閲覧も含めて）
- **NG-3: 特定用途特化アプリの直接実装はしない**（家計簿専用 UI / レシピ専用 UI などは作らず、汎用 Database で実現）
- **NG-4: Claude API 直接課金は使わない**（Max サブスク Claude Code ラッピングで $0 を維持。将来例外検討は留保）
- **NG-5: モバイル単独起動（Desktop なし）はサポートしない**（Desktop が primary creation device、iOS は consumption + quick capture）
- **NG-6: 既存サービスのフル機能代替は目指さない**（Google Calendar の予定編集など、外部サービスは参照中心 / 片方向同期から）

---

## 5. Platform Strategy

### 役割定義

- **Desktop (macOS / Windows / Linux — Tauri 2.0)**: Primary creation device。すべての機能が揃う。コーディング、AI 対話、深い思考作業
- **Mobile (iOS — Tauri 2.0)**: Consumption + Quick capture。外出時の参照・スケジュール確認・メモ追加
- **Cloud (Cloudflare Workers + D1)**: Desktop ↔ iOS 間の SQLite テーブル双方向同期のみ。Web UI / 認証 UI は提供しない

### Provider セット差分（詳細）

- **デスクトップ Provider**（外→内）: ErrorBoundary → Theme → Toast → UndoRedo → ScreenLock → TaskTree → Calendar → Template → Memo → Note → FileExplorer → Routine → ScheduleItems → CalendarTags → Timer → Audio → WikiTag → ShortcutConfig
- **モバイル Provider**（外→内）: ErrorBoundary → Theme → Toast → UndoRedo → TaskTree → Calendar → Template → Memo → Note → Routine → ScheduleItems → Timer

モバイルで省略: ScreenLock, FileExplorer, CalendarTags, Audio, WikiTag, ShortcutConfig

機能差分マトリクスは CLAUDE.md §2 Platform を参照。
