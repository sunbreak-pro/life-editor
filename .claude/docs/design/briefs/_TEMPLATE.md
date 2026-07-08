---
Status: Draft # Draft → Ready（ClaudeDesign 投入可）→ Generated（デザイン生成済み）
Created: YYYY-MM-DD
Section: <section-id> # schedule / materials / connect / work / analytics / settings / shell / auth / trash
Owner-chat: design-<section>
Branch: claude/design-brief-<section>
---

# Design Brief: <画面名>

> 目的: **この 1 ファイルだけで「ClaudeDesign に貼るプロンプト」とその根拠が完結する**こと。
> ClaudeDesign はリポジトリを読めないため、§4 のプロンプト本文は自己完結させる
> （リポジトリのパス・「上記参照」「§1 の通り」等の内部参照を本文に書かない）。

## 1. 画面要件ダイジェスト

（`.claude/docs/requirements/` の該当 Feature と現行実装から。引用は `file:line` 付き）

- **目的 / 主ユースケース**:
- **表示するデータ**（エンティティ・件数感・現実的なサンプル値）:
- **主要操作**（作成 / 編集 / 削除 / 並替 / フィルタ等）:
- **Desktop / Mobile の責務分割**（Mobile = Consumption + Quick capture。**何を落とすかを明記**）:

## 2. 現状 UI インベントリ

- **host 画面**: `web/src/...`
- **shared 部品**: `shared/src/components/...`
- **特徴的 UI**（グリッド / グラフ / キャンバス / DnD / エディタ等）:
- **状態の現状**: empty / loading / error の実装有無
- **現状の課題**（デザイン観点で改善したい点を 3〜7 個。これがプロンプトの「良くしたい方向」になる）:

## 3. デザイン方針（このセッションの提案）

- **残す意匠 / 変える意匠**:
- **使う既存部品**（Button / Card / Sheet / BottomSheet / Menu / Toast / Sidebar / Kanban / MasterDetail / CommandPalette 等）:
- **新規に必要な部品候補**（あれば。部品層 `shared/src/components/` への追加候補として列挙するだけ。実装しない）:

## 4. ClaudeDesign プロンプト

> 各プロンプトの冒頭に `_COMMON-CONTEXT.md` の水平線以降を**全文コピー**してから、画面固有の指示を続ける。
> プロンプトは日本語で書く（コンポーネント名・色値は英語 / hex のまま）。
> 表示データは現実的な日本語サンプル値で具体的に指定する（「タスク名 A」ではなく「確定申告の書類を集める」のように）。

### 4.1 Desktop 用

```text
（_COMMON-CONTEXT 全文）

---

## この画面: <画面名>（Desktop 1440×900）
（画面固有の指示: レイアウト構造 / 表示データのサンプル / 操作要素 / 状態バリエーション / light・dark）
```

### 4.2 Mobile 用

```text
（_COMMON-CONTEXT 全文）

---

## この画面: <画面名>（Mobile 390×844）
（Consumption + Quick capture 責務に絞った指示。Desktop から何を落としたかが分かるように）
```

（materials のように複数サブ画面を含む brief は 4.1〜4.n に増やしてよい。Desktop / Mobile のペア構造は維持する）

## 5. Acceptance Criteria（brief 自体の完成条件）

- [ ] §4 の全プロンプトが自己完結している（リポジトリのパス・内部参照・「上記参照」が本文に無い）
- [ ] `_COMMON-CONTEXT.md` の共通前提ブロックが**全プロンプトの冒頭に全文**埋まっている（要約・改変なし）
- [ ] Desktop / Mobile 両方のプロンプトがあり、フレーム仕様（1440×900 / 390×844・light / dark）が明記されている
- [ ] 通常（データあり）/ 空 / ローディング状態の指示がある（該当すればエラーも）
- [ ] 表示データが日本語の現実的なサンプルで指定されている
- [ ] Mobile の責務削減（**何を出さないか**）が明記されている
- [ ] §1-2 の引用が `file:line` 付きで実在する
- [ ] frontmatter の Status / Section / Owner-chat / Branch が埋まっている

## 6. 生成後の運用メモ

- 分業: 生成 = claude.ai/design 側（ユーザーがプロンプト投入）/ Claude Code 側 DesignSync は同期専用 / 出荷 UI 化は `shared/src/components/` への移植（別計画）
- 移植先候補: `shared/src/components/...`（生成結果を見てから確定）
- 生成デザインへのフィードバックで本 brief の §4 を更新した場合、Status と履歴を追記する
