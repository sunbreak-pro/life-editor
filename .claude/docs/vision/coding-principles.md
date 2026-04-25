# Coding Principles

> 本プロジェクトの設計原則を集約する場所。過去の ADR（0001-0007）の要旨を統合し、現在から未来に向けた指針として保持する。
> 実装規約（Pattern A / Provider 順序等）は CLAUDE.md §6-7 が正本。本ファイルは「なぜ」と「将来の判断材料」を残す。

---

## 1. Tauri IPC 命名方針（旧 ADR-0006 要旨）

### 規約

- **Rust 側**: 引数 / 戻り値とも `snake_case`（Rust 慣習）
- **TypeScript 側**: `invoke()` 呼び出し引数は `camelCase`（JS 慣習）
- **自動変換依存**: serde の双方向自動変換を前提とする
- **戻り値型**: 必ず `#[derive(Serialize)]` を付ける。Repository 層の `rowToModel` が `snake_case → camelCase` 変換することを PR レビューで確認
- **複雑な引数構造体**（DTO）: Rust 側 `snake_case` + `#[serde(rename_all = "camelCase")]` 属性で整合
- **3 点同期**: IPC 追加 / 変更時は `src-tauri/src/commands/` + `src-tauri/src/lib.rs` + `frontend/src/services/TauriDataService.ts` の整合を手動確認（CLAUDE.md §7.2）

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

詳細規約は CLAUDE.md §6.3。

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

iOS クライアントは Desktop の Provider の一部（Audio / ScreenLock / FileExplorer / CalendarTags / WikiTag / ShortcutConfig）を持たない。共有コンポーネントが Provider 必須 hook を呼ぶと Mobile で crash する。

### 規約

- **Mobile 省略 6 Provider は Optional バリアント必須**
- 必須 hook (`createContextHook`): Provider 外で throw → Desktop 用
- Optional hook (`createOptionalContextHook`): Provider 外で null → Mobile 共有コンポーネントで `if (!ctx) return null` ガード
- ファイル命名: `useFooContextOptional.ts`（`frontend/src/hooks/` 配下）

---

## 5. UI 透明度ポリシー

### 規約

**主要 UI コンテナの背景に透明度は使わない。** ポップオーバー / ドロップダウン / メニュー / ダイアログ / カード / パネル等の本体背景は完全不透明とする。

### 許容する透明度（例外）

以下は方針例外として継続使用する:

- **ホバーフィードバック**: `hover:bg-notion-hover` 等の薄い feedback（インタラクション認知のため）
- **モーダル背後のバックドロップ**: `bg-black/30` 等のオーバーレイ層（フォーカス誘導のため）
- **アクセントカラーの薄塗り**: `bg-notion-accent/10` 等のチップ選択状態 / 強調（カラー意匠）
- **ボーダー / リング**: `border-notion-border/60`、`ring-notion-accent/40` 等の装飾線
- **disabled / dragging**: `opacity-50`、`opacity-30`（状態表現のため）
- **影**: `shadow-*`（透明度ベースだが視認性に貢献するため許容）

### 禁止例

- ❌ `bg-notion-bg-popover`（CSS 変数未定義 → 透明落ち）
- ❌ ポップオーバー本体に `bg-*\/70` `bg-*\/80`（コントラスト不足）
- ❌ メインコンテナの `backdrop-blur-*`（OS 半透過効果は不採用）

### 背景

- ガラス風 UI は macOS ネイティブ App でも使い分けが難しい。多用すると下地依存で可読性が低下
- Tailwind の未定義カラークラスは silent fail で透明落ちする → `bg-notion-bg` 等の **定義済み変数のみ** を使う
- ホバー / オーバーレイ / アクセント等、**意味のある透明** は意匠として残す（全廃ではない）

### 修正パターン

| Before                                       | After                                    | 場面                                |
| -------------------------------------------- | ---------------------------------------- | ----------------------------------- |
| `bg-notion-bg-popover`                       | `bg-notion-bg`                           | ポップオーバー / ドロップダウン本体 |
| `bg-notion-bg-secondary/70 backdrop-blur-sm` | `bg-notion-bg-secondary`                 | パネル本体                          |
| `bg-white/20 hover:bg-white/30`              | `bg-notion-hover hover:bg-notion-active` | ホバー feedback（white ベース廃止） |

### 検出コマンド

```bash
# ポップオーバー / メニューで透明背景になりうる箇所
grep -rn "bg-notion-bg-popover\|bg-.*\/[0-9]\+ backdrop-blur" frontend/src --include='*.tsx'

# 未定義 Tailwind カラー（CSS 変数を確認）
grep -rn "bg-notion-bg-[a-z]" frontend/src --include='*.tsx' | sort -u
```

新しく未定義の `bg-notion-bg-*` を導入する場合は `frontend/src/index.css` で必ず CSS 変数を定義する。

---

## 6. 設計原則の更新フロー

1. 新しい設計判断が必要 → 本ファイル該当章への追記 or 新章作成を検討
2. 実装規約になったもの → CLAUDE.md §6-7 に移す（本ファイルには「なぜ」を残す）
3. 将来の再評価トリガーを「将来再評価のトリガー」節に明記
4. 廃案 / 却下された判断も残す（却下理由の記録が将来の再発防止になる）
