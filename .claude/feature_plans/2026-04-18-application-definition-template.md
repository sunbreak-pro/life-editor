# Plan: 最上位アプリケーション定義書（テンプレート）

**Status:** PLANNED
**Created:** 2026-04-18
**Task:** `2026-04-18-app-redefinition-roadmap.md` Step 1 の雛形
**Project:** /Users/newlife/dev/apps/life-editor

---

## Context

次セッションで Life Editor の最上位定義書を作成する際の記入雛形。このファイル自体は "埋めるべき空欄集" であり、埋めた結果は `.claude/docs/definition.md` または `README.md` の冒頭に配置する。

**使い方**:

1. 各セクションの「記入ガイド」を読む
2. `<!-- 記入 -->` コメントを実内容に置き換える
3. 全セクション埋まったら `.claude/docs/definition.md` として独立ファイル化
4. CLAUDE.md / README.md / TODO.md / `2026-04-17-daily-life-hub-requirements.md` と突き合わせて矛盾を列挙
5. ユーザー（作者）レビューで承認

**前提となる既存ビジョン**（`2026-04-17-daily-life-hub-requirements.md` より）:

> Life Editor を「AI と一緒に生活を設計する」日常のハブアプリケーションにする。
> Notion のような汎用データベース基盤を活かし、タスク管理・スケジュール・知識管理・家計・学習を
> 一つのアプリケーション内で完結させる。

このビジョンを起点として、以下 8 セクションを埋める。

---

## Template（次セッションで埋める）

### 1. Core Identity

**記入ガイド**: アプリを 1 文で定義する。「〇〇するための △△」形式。Elevator Pitch は 30 秒で話せる長さ（100 字以内）。

**1-line definition**:

<!-- 記入: 例「AI と会話しながら自分の生活を設計・記録・運用するためのパーソナル OS」 -->

**Elevator pitch (≤100 字)**:

<!-- 記入 -->

**この定義で意図的に外したもの**:

<!-- 記入: 例「『チームコラボツール』は含まない（個人利用前提）」 -->

---

### 2. Target User

**記入ガイド**: 「誰のためのアプリか」を具体化。作者自身がユーザーなら「自分 (= N=1)」と明記し、その仕様（例: 平日 10h PC、週末 iPhone、Claude Code heavy user）を書く。広く展開したいなら 2〜3 種類のペルソナ。

**Primary User**:

<!-- 記入: 例「本人（開発者）— 平日は macOS、週末は iOS、Claude Code で日常的にファイル操作」 -->

**Key user characteristics（重要な 3〜5 点）**:

- <!-- 記入 -->

**Non-users（明示的に対象外）**:

<!-- 記入: 例「複数人で共有するチーム」「紙ベースの記録を好む人」 -->

---

### 3. Core Value Propositions

**記入ガイド**: 既存アプリ（Notion / TickTick / Obsidian / Apple Reminders / Todoist 等）に対する差別化点を 3 点前後。各ポイントには「なぜこれが可能か」の技術的根拠も添える。

**Value 1**: <!-- 記入: 例「AI が自然言語で全データを操作できる」 -->

- 根拠: <!-- 例「MCP Server 経由で 30+ ツールを公開、Claude Code が DB 直接操作」 -->
- 比較: <!-- 例「Notion AI は UI 経由のみ、Obsidian は AI プラグインも外部サービス依存」 -->

**Value 2**: <!-- 記入 -->

- 根拠: <!-- 記入 -->
- 比較: <!-- 記入 -->

**Value 3**: <!-- 記入 -->

- 根拠: <!-- 記入 -->
- 比較: <!-- 記入 -->

---

### 4. Non-Goals

**記入ガイド**: 「これはやらない」を 5 点前後で明記。境界線を引くことで Feature creep を防ぐ。

- <!-- 記入: 例「マルチテナント / チームコラボ機能は持たない」 -->
- <!-- 記入: 例「モバイル単独起動（Desktop 無し）は対応しない — Desktop が primary」 -->
- <!-- 記入: 例「決済・EC 連携は持たない（家計簿は記録のみ）」 -->
- <!-- 記入 -->
- <!-- 記入 -->

---

### 5. Platform Strategy

**記入ガイド**: Desktop / Mobile / Cloud の 3 面それぞれの役割と機能差分を明確化。「何ができて何ができないか」を Feature 単位で記述。

**Desktop (macOS/Windows/Linux — Tauri 2.0)**:

- 役割: <!-- 記入: 例「Primary creation device — すべての機能が揃う」 -->
- 有り: <!-- 記入: 例「全 Provider (Audio, WikiTag, ScreenLock 等)、ターミナル、Paper Boards、MCP Server 起動導線」 -->
- 無し: <!-- 記入 -->

**Mobile (iOS — Tauri 2.0)**:

- 役割: <!-- 記入: 例「Consumption + Quick capture — 外出時の参照・記録" -->
- 有り: <!-- 記入: 例「Materials / Calendar / Work / Settings 4 タブ、Cloud Sync」 -->
- 無し: <!-- 記入: 例「AudioProvider, ScreenLock, FileExplorer, WikiTag, ShortcutConfig, ターミナル」 -->
- **決断**: <!-- 記入: 例「モバイルで省略する Provider は今後も追加しない」 -->

**Cloud (Cloudflare Workers + D1)**:

- 役割: <!-- 記入: 例「Desktop ↔ iOS 間のデータ同期のみ。バックアップは副次効果」 -->
- 有り: <!-- 記入 -->
- 無し: <!-- 記入: 例「Web UI は提供しない — 閲覧は Desktop/iOS から」 -->

---

### 6. Data Model Philosophy

**記入ガイド**: 「Notion 的な汎用 DB」と「特化機能（Tasks / Schedule / Routine / Notes / Memo）」の境界線を引く。どこまで汎用化し、どこから特化を許すか。

**特化機能として固定するもの** (スキーマ変更なし):

- <!-- 記入: 例「TaskNode (status/parentId/order/scheduledAt)」 -->
- <!-- 記入: 例「Routine (frequency/time/days)」 -->

**Database (汎用 DB) で表現するもの**:

- <!-- 記入: 例「家計簿、読書記録、学習進捗、連絡先」 -->

**どちらでも表現可能な境界例** (現状未決定):

- <!-- 記入: 例「食事記録 → 特化 Memo? 汎用 DB?」 -->

**PropertyType 拡張方針**:

- 現状: text / number / select / date / checkbox
- 追加判断基準: <!-- 記入: 例「Value Proposition を直接支える型のみ追加。relation は必須、formula は中優先」 -->

---

### 7. AI Integration Strategy

**記入ガイド**: 「AI と一緒に生活を設計する」ビジョンの具体化。Claude Code / MCP Server の位置づけ、UI 導線、将来の AI 機能（要約 / 提案 / 自動分類）。

**現状の AI 統合**:

- MCP Server (`mcp-server/`): <!-- 記入 -->
- アプリ内ターミナルから Claude Code 起動: <!-- 記入 -->

**「AI と一緒」が具体的に意味するシナリオ** (3 つ):

1. <!-- 記入: 例「ユーザーが『今週の買い物まとめて』と話すと、Claude が関連メモから抽出してタスク化」 -->
2. <!-- 記入 -->
3. <!-- 記入 -->

**AI 不使用でも成立する機能の割合**:

<!-- 記入: 例「コア機能の 80% は AI なしで動作。AI は上位体験として積む」 -->

**今後の AI 機能ロードマップ**:

- 短期 (〜3 ヶ月): <!-- 記入 -->
- 中期 (3〜12 ヶ月): <!-- 記入 -->
- 長期 (1 年+): <!-- 記入 -->

---

### 8. Feature Tier

**記入ガイド**: 現状の全機能を 3 Tier に分類。Tier 1 = Value Proposition を直接支える / Tier 2 = 補助 / Tier 3 = 実験・任意。Tier 3 は凍結または削除候補。

**Tier 1 (Core — これが無かったら Life Editor ではない)**:

- <!-- 記入: 例「Tasks (ツリー + スケジュール + ステータス)」 -->
- <!-- 記入: 例「Schedule (Routine + 日次 + Calendar Tags)」 -->
- <!-- 記入: 例「Notes / Memo (知識・日次記録)」 -->
- <!-- 記入: 例「MCP Server (AI 操作基盤)」 -->
- <!-- 記入: 例「Cloud Sync (Desktop ↔ iOS)」 -->

**Tier 2 (Supporting — あると嬉しい)**:

- <!-- 記入: 例「Audio Mixer + Playlist (作業集中)」 -->
- <!-- 記入: 例「Pomodoro Timer」 -->
- <!-- 記入: 例「WikiTags (横断タグ)」 -->
- <!-- 記入: 例「Database (汎用 DB for 家計簿等)」 -->
- <!-- 記入: 例「File Explorer / Attachments」 -->

**Tier 3 (Experimental — 凍結 / 削除候補)**:

- <!-- 記入: 例「Paper Boards (ビジュアルキャンバス)」 -->
- <!-- 記入: 例「Analytics (基盤のみで未活用)」 -->
- <!-- 記入 -->

**Tier 3 の扱い方針**:

<!-- 記入: 例「半年メンテせずバグ顕在化したら削除判断。それまでは現状維持で負債リストに記録」 -->

---

## Files

| File                                                                  | Operation | Notes                                       |
| --------------------------------------------------------------------- | --------- | ------------------------------------------- |
| `.claude/feature_plans/2026-04-18-application-definition-template.md` | Create    | 本ファイル（雛形）                          |
| `.claude/docs/definition.md`                                          | Create    | 記入完了後の成果物（または README.md 先頭） |
| `.claude/feature_plans/2026-04-17-daily-life-hub-requirements.md`     | Reference | 既存ビジョン                                |
| `CLAUDE.md`                                                           | Compare   | 矛盾検出対象                                |
| `README.md`                                                           | Compare   | 矛盾検出対象                                |
| `TODO.md`                                                             | Compare   | 矛盾検出対象                                |
| `.claude/docs/adr/*.md`                                               | Compare   | Provider パターン等の設計判断との整合性     |

---

## Verification

- [ ] 全 8 セクションに `<!-- 記入 -->` が残っていない
- [ ] Core Identity の 1-line definition が「誰が読んでも同じ理解になる」レベルに具体的
- [ ] Non-Goals が 5 点以上
- [ ] Feature Tier で全機能（現状 15 機能程度）が分類済み、未分類ゼロ
- [ ] Mobile Platform Strategy で省略 Provider 一覧が現状と一致
- [ ] AI Integration Strategy のシナリオ 3 つが「今すぐ or 近々可能」レベルに具体的（架空の未来機能でない）
- [ ] CLAUDE.md / README.md との矛盾点リストが添付されている（「矛盾なし」なら明記）
- [ ] ユーザーレビュー承認コメントが記録されている

---

## Notes for Next Session

- 作業時間目安: 集中して 2〜3 時間。ユーザー対話でセクション毎に確認する
- セクション 1〜4（定義・ユーザー・価値・Non-Goals）を先に固める。5〜8 はそこから導出
- セクション 7 (AI) は現状の薄さが露呈しやすい。「今はまだ弱い」と書くことも OK
- セクション 8 (Tier) で Paper Boards / Analytics の位置づけは議論必要。即決しない
