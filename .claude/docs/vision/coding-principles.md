# Coding Principles

> 本プロジェクトの設計原則を集約する場所。過去の ADR（0001-0007）の要旨を統合し、現在から未来に向けた指針として保持する。
> 実装規約（Pattern A / Provider 順序等）は CLAUDE.md §6-7 が正本。本ファイルは「なぜ」と「将来の判断材料」を残す。

---

## 1. Tauri IPC 命名方針（旧 ADR-0006 要旨）

> ⚠️ **retired（2026-07-11 #197）**: 旧 Tauri スタック（`src-tauri/` / `frontend/`、本章が依存を列挙していた `TauriDataService.ts` / `bridge.ts` / `events.ts` 含む）は削除済み（復元 = git tag `pre-tauri-removal`）。本章は当時の規約と障害経緯の歴史的記録として保持する。新規 IPC 規約は Electron 包装（Phase 3 以降）で別途確定。

### 規約

- **Rust 側**: 引数 / 戻り値とも `snake_case`（Rust 慣習）
- **TypeScript 側**: `invoke()` 呼び出し引数は `camelCase`（JS 慣習）
- **自動変換依存**: serde の双方向自動変換を前提とする
- **戻り値型**: 必ず `#[derive(Serialize)]` を付ける。Repository 層の `rowToModel` が `snake_case → camelCase` 変換することを PR レビューで確認
- **複雑な引数構造体**（DTO）: Rust 側 `snake_case` + `#[serde(rename_all = "camelCase")]` 属性で整合
- **4 点同期**: IPC 追加 / 変更時は `src-tauri/src/commands/` + `src-tauri/src/lib.rs` + `frontend/src/services/DataService.ts`（インターフェース定義）+ `frontend/src/services/TauriDataService.ts`（実装）の整合を手動確認。**正本は `add-ipc-channel` スキル**（点数・手順はそちらに従う）

### 背景

2026-04-18 に戻り値型の `snake_case` 不整合 4 件（TagAssignment 関連）が原因のプロダクションバグを修正した経緯あり。全 150 コマンドの typed struct 化（struct Input 移行）はコスト高の割に事故予防価値が低いため実施せず、レビュー時の手動確認で事故予防する方針。

### 将来再評価のトリガー

- Tauri 3.0 リリース時の破壊的変更チェック
- ESLint custom rule で `invoke()` 引数の camelCase チェック自動化（別案）

---

## 2. Context/Provider Pattern A（旧 ADR-0002 要旨）

### 3 ファイル構成

1. `context/FooContextValue.ts` — interface + `createContext<T | null>(null)`
2. `context/FooContext.tsx` — Provider component（hook 呼び出し + useMemo）
3. `hooks/useFooContext.ts` — `createContextHook(FooContext, "useFooContext")`

### 設計原則

- **内側 Provider は外側 Context に依存可**（逆不可）
- **自己完結する小規模 Context は単一ファイル許可**（`ToastContext` 等）
- **DataService 依存はコールバック注入**（フック内で直接 `getDataService()` を呼ばない）
- **ジェネリクスでエンティティ型を外部化**（`useDataFetch<T>(fetcher)`）

詳細規約は [`.claude/rules/frontend.md`](../../rules/frontend.md)。

---

## 3. Schedule Provider 3 分割（旧 ADR-0003 要旨）

### 背景

単一の `ScheduleProvider` がルーチン・スケジュール項目・カレンダータグの 3 責務を抱え、テスト困難 + backfill 依存が複雑化していた。

### 規約

- `RoutineProvider` / `ScheduleItemsProvider` / `CalendarTagsProvider` の 3 分割
- `useScheduleContext()` は後方互換ファサード。新コードでは個別 hook 直接使用推奨
- Calendar / DayFlow / Routine の 2 つ以上から参照されるコンポーネントは `Schedule/shared/` に配置（旧 ADR-0004）

---

## 4. Mobile Provider 戦略（旧 ADR-0007 要旨）

### 背景

iOS クライアントは Desktop の Provider の一部を持たない（省略リストの正 = CLAUDE.md §2。旧記載の CalendarTags は DU-F で全プラットフォーム撤去・WikiTag は Mobile でも有効化済み）。共有コンポーネントが Provider 必須 hook を呼ぶと Mobile で crash する。

### 規約

- **Mobile 省略 Provider（一覧は CLAUDE.md §2 が正）は Optional バリアント必須**
- 必須 hook (`createContextHook`): Provider 外で throw → Desktop 用
- Optional hook (`createOptionalContextHook`): Provider 外で null → Mobile 共有コンポーネントで `if (!ctx) return null` ガード
- ファイル命名: `useFooContextOptional.ts`（`shared/src/hooks/` 配下 — `frontend/` は FROZEN）

---

## 5. UI 透明度ポリシー

### 規約

**主要 UI コンテナの背景に透明度は使わない。** ポップオーバー / ドロップダウン / メニュー / ダイアログ / カード / パネル等の本体背景は完全不透明とする。

### 許容する透明度（例外）

以下は方針例外として継続使用する:

- **ホバーフィードバック**: `hover:bg-lumen-hover` 等の薄い feedback（インタラクション認知のため）
- **モーダル背後のバックドロップ**: `bg-black/30` 等のオーバーレイ層（フォーカス誘導のため）
- **アクセントカラーの薄塗り**: `bg-lumen-accent/10` 等のチップ選択状態 / 強調（カラー意匠）
- **ボーダー / リング**: `border-lumen-border/60`、`ring-lumen-accent/40` 等の装飾線
- **disabled / dragging**: `opacity-50`、`opacity-30`（状態表現のため）
- **影**: `shadow-*`（透明度ベースだが視認性に貢献するため許容）

### 禁止例

- ❌ `bg-lumen-bg-popover`（CSS 変数未定義 → 透明落ち）
- ❌ ポップオーバー本体に `bg-*\/70` `bg-*\/80`（コントラスト不足）
- ❌ メインコンテナの `backdrop-blur-*`（OS 半透過効果は不採用）

### 背景

- ガラス風 UI は macOS ネイティブ App でも使い分けが難しい。多用すると下地依存で可読性が低下
- Tailwind の未定義カラークラスは silent fail で透明落ちする → `bg-lumen-bg` 等の **定義済み変数のみ** を使う
- ホバー / オーバーレイ / アクセント等、**意味のある透明** は意匠として残す（全廃ではない）

### 修正パターン

| Before                                      | After                                  | 場面                                |
| ------------------------------------------- | -------------------------------------- | ----------------------------------- |
| `bg-lumen-bg-popover`                       | `bg-lumen-bg`                          | ポップオーバー / ドロップダウン本体 |
| `bg-lumen-bg-secondary/70 backdrop-blur-sm` | `bg-lumen-bg-secondary`                | パネル本体                          |
| `bg-white/20 hover:bg-white/30`             | `bg-lumen-hover hover:bg-lumen-active` | ホバー feedback（white ベース廃止） |

### 検出コマンド

```bash
# ポップオーバー / メニューで透明背景になりうる箇所
grep -rn "bg-lumen-bg-popover\|bg-.*\/[0-9]\+ backdrop-blur" shared/src web/src --include='*.tsx'

# 未定義 Tailwind カラー（CSS 変数を確認）
grep -rn "bg-lumen-bg-[a-z]" shared/src web/src --include='*.tsx' | sort -u
```

新しく未定義の `bg-lumen-bg-*` を導入する場合は `shared/src/styles/tokens.css` で必ず CSS 変数を定義する。

---

## 6. UI 2 層モデル（部品層 = 全環境共通 / 画面層 = 機能別判断）

クロスプラットフォーム移行（Web / Electron / Capacitor）で UI をどこまで共通化するかの恒久原則。出典: 計画書 `../../archive/2026-06-07-web-desktop-parity-roadmap.md`「中核設計思想」（W0 = 旧 W-parity ロードマップの土台タスクで確定〔2026-06-07・案 A〕・#154 で archive へ移動）。

UI を 2 層に分け、共通化の度合いを層ごとに変える:

| 層                             | 内容                                                              | 共通化方針                                                                 |
| ------------------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **部品層（デザインシステム）** | ボタン / 入力欄 / カード / モーダル / シート / `lumen-*` トークン | **全環境で完全共通**。`shared/src/components/` に集約（直す場所は 1 箇所） |
| **画面層（レイアウト）**       | 各機能画面の組み立て方                                            | **機能特性で判断**：単純画面 = レスポンシブ単一 / 複雑画面 = 環境別分割    |

- **単純画面**（縦並びリスト系: Settings / Trash / Notes / Daily 等）は 1 コンポーネントを画面幅で伸縮させるレスポンシブ単一にする。
- **複雑画面**（PC とスマホで操作モデルが別物: Schedule カレンダー / Tasks DnD ツリー / Work タイマー = マウスドラッグ vs タップ + BottomSheet）は割り切って環境別に分割する。無理に単一化すると分岐だらけで破綻する。
- **やりすぎ回避**: 全画面を 1 コンポーネントで完全レスポンシブ化はしない。迷ったら単一で始め、必要になってから分割する。

**集約先（W0 で確定 = 案 A）**: 部品（デザインシステム）・`lumen-*` トークン・**i18n（en/ja catalog + 設定済み i18next singleton）** はすべて `shared/` に集約し、3 配布形態（Web / Electron / Capacitor）が同じソースを共用する。

- 部品: `shared/src/components/`（barrel `index.ts` → `shared/src/index.ts`）
- トークン: `shared/src/styles/tokens.css`（host が `@import` + `@source` でスキャン）
- i18n: `shared/src/i18n/`（catalog + init）。host は `i18n` / `I18nProvider` を import して木を包み、**画面層**が `useTranslation` を呼ぶ
- **i18n の不変式は維持（詳細 = `.claude/rules/frontend.md`）**: 共有 _部品_ のフック内で `useTranslation` を呼ばない。文言は props 経由。`useTranslation` を使ってよいのはアプリ・画面層のみ（shared は singleton 解決のため再エクスポートするだけ）

---

## 7. AI コスト $0 ラッピング方式（旧 ADR-0005 要旨）

### 規約

- Claude API へ直接課金しない。AI 連携は Claude Code（Max サブスクリプション）を MCP Server 経由で実行体として使う「ラッピング方式」で追加コスト $0 を維持する（CLAUDE.md §1 Non-Goals / core.md V1）
- MCP Server は独立 Node.js プロセスとして存続。起動導線だったアプリ内ターミナルは 2026-07-05 に退役決定（常設起動導線は生成デザイン確定後に再設計）

### 将来再評価のトリガー

- Max プランの提供条件・料金の変更
- Claude API の大幅なコスト低下（直課金の再検討は「将来例外検討は留保」= core.md NG-4 に従う）

---

## 8. 設計原則の更新フロー

1. 新しい設計判断が必要 → 本ファイル該当章への追記 or 新章作成を検討
2. 実装規約になったもの → CLAUDE.md §6-7 に移す（本ファイルには「なぜ」を残す）
3. 将来の再評価トリガーを「将来再評価のトリガー」節に明記
4. 廃案 / 却下された判断も残す（却下理由の記録が将来の再発防止になる）
