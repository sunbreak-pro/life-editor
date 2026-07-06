---
Status: Ready # Draft → Ready（ClaudeDesign 投入可）→ Generated（デザイン生成済み）。本 brief は _COMMON-CONTEXT v2 を最初から埋め込んで作成したため resync 不要
Created: 2026-07-05
Section: trash
Owner-chat: design-trash
Branch: claude/design-trash
---

# Design Brief: ゴミ箱（Trash）

> 目的: **この 1 ファイルだけで「ClaudeDesign に貼るプロンプト」とその根拠が完結する**こと。
> ClaudeDesign はリポジトリを読めないため、§4 のプロンプト本文は自己完結させる
> （リポジトリのパス・「上記参照」「§1 の通り」等の内部参照を本文に書かない）。

## 1. 画面要件ダイジェスト

- **目的 / 主ユースケース**: 全ドメイン共通のソフトデリート（`is_deleted=1` + `deleted_at`）モデルを、単一の UI で復元 / 完全削除する「誤削除からの復旧窓口」（`.claude/docs/requirements/tier-2-supporting.md:486`）。日常的に開く画面ではなく、消したものを戻す・掃除するための低頻度アクセスのユーティリティ画面。削除は `deleted_at` 降順で並ぶ想定（`tier-2-supporting.md:502`）
- **表示するデータ**: web（W2）実装が surface する 5 カテゴリの削除済み項目 = tasks / notes / dailies / routines / events（型は `shared/src/components/TrashView.tsx:19-24`、host の並列 fetch は `web/src/trash/TrashScreen.tsx:57-63`）。各行は id + 表示ラベル（title、無ければ "Untitled"、daily は日付文字列 — `TrashScreen.tsx:64-90`）。件数感は数件〜十数件（削除は稀）。要件は Tasks / Notes / Memos / Routines / Databases / Templates / ScheduleItems + CustomSounds を対象に挙げる（`tier-2-supporting.md:491,509`）が、現行 web が扱うのはこの 5 つ（Databases / Templates / CustomSounds は web 未実装）
- **主要操作**: 復元（`restoreByCategory` — `TrashScreen.tsx:122-133,174-191`。`is_deleted=0` + `deleted_at=NULL` に戻る `tier-2-supporting.md:503`）/ 完全削除（**確認モーダル経由**で `permanentDeleteByCategory` — `TrashScreen.tsx:135-146,193-209`。関連レコードもカスケード削除 `tier-2-supporting.md:504`）。どちらも操作後に全カテゴリを再 fetch してリストを更新（`TrashScreen.tsx:112-120`）。処理中は `busy` で連打をブロック（`TrashScreen.tsx:31,122-146`）。一括完全削除・自動パージ（30 日経過での自動削除）は現行 web に無い（要件でも自動パージは未実装 `tier-2-supporting.md:496`）
- **Desktop / Mobile の責務分割**: Trash は「閲覧して誤削除を戻す」Consumption 寄りの窓口なので、**Mobile でも機能は落とさず**、レスポンシブ単一カラムで同じ操作（復元 / 完全削除 / 確認）を提供する（構造分岐は不要）。差は置き場所だけ: Desktop は本流 5 セクションから視覚分離した下部ユーティリティ枠、Mobile は下部固定 4 タブに入らず More のボトムシート経由で開く（`.claude/docs/design/IA.md:14,27,42`）

## 2. 現状 UI インベントリ

- **host 画面**: `web/src/trash/TrashScreen.tsx:26`（5 カテゴリを `Promise.all` で並列 fetch `:57-63` → grouped data に整形 `:64-90`、restore / permanentDelete 後に再 fetch `:112-120`、loading / error / busy の 3 状態を保持 `:29-31`）。マウントは `web/src/MainScreen.tsx:397`（`section === "trash"`。Provider を挟まず host が DataService を直呼び — CLAUDE.md §6.4 の host 例外）
- **shared 部品**: `shared/src/components/TrashView.tsx:70`（pure presentation・データと操作は全て props 注入。`lumen-*` トークンのみ・Card / Modal パネルは不透明）
- **特徴的 UI**:
  - 画面見出し = `h2` のみ（`TrashView.tsx:90`）。ページヘッダ・説明文なし
  - 全体空 = 中央寄せ Card 1 枚「ゴミ箱は空です」（`TrashView.tsx:94-97`）
  - カテゴリ = 大文字トラッキングの `h3` 見出し + 行リスト（`Card padding="none"` + `divide-y` — `TrashView.tsx:100-140`）。空カテゴリも `emptyCategory` の 1 行を描画する（`:104-107`）
  - 行 = 項目名 truncate + 復元 IconButton（`RotateCcw`・ghost・`:119-126`）+ 完全削除 IconButton（`Trash2`・danger・`:127-136`）。どちらも `size="sm"` のアイコンのみ（テキストラベルは aria のみ）
  - 完全削除 = Modal 確認（`TrashView.tsx:146-168`。`{name}` 差し込みの本文 + 「キャンセル」secondary / 「完全に削除」danger の 2 ボタン）
  - busy 中は行内の両ボタンが一律 disabled（`TrashView.tsx:124,132`）
- **状態の現状**: loading = 素のテキスト 1 行（`TrashScreen.tsx:148-149`）/ error = 素の danger テキスト 1 行（`:151-152`）。skeleton やエラーカード（再読込導線）は無い。全体空のみ意匠あり
- **現状の課題**（デザインで良くしたい方向）:
  1. ページヘッダ（h1 相当 + 説明）が無く `h2` の素積みで、ユーティリティ画面としての骨格が弱い。「自動では消えない＝手動で掃除する場所」という性質も伝わっていない
  2. カテゴリ見出しに件数バッジが無く、どのカテゴリに何件残っているか一目で分からない
  3. 空カテゴリも見出し + `emptyCategory` 行を描くため、削除が少ないと空セクションが 5 個並んで冗長になる
  4. 復元と完全削除がどちらも同じ `size="sm"` アイコンボタンで、危険度の差が色（ghost / danger）だけ。取り返しのつかない完全削除が、安全な復元と同格の存在感で並ぶ（危険度の非対称が弱い）
  5. loading / error が素のテキスト 1 行で、専用の skeleton・エラーカード（再読込ボタン）が無い
  6. busy 中は全ボタンが一律 disabled になるだけで、どの行を処理中かのフィードバックが無い
  7. 完全削除の確認文に、カスケード削除（子タスク・タグ割り当ても一緒に消える。要件 AC3 `tier-2-supporting.md:504`）への警告が無い

## 3. デザイン方針（このセッションの提案）

- **残す意匠**: pure presentation + props 注入モデル / 復元 = ghost・完全削除 = danger の色分け / Modal による確認ステップ / カテゴリ別グルーピング / 操作後の即時 re-fetch。**ユーティリティ枠として本流セクションより控えめな視覚的重み**（実務的で落ち着いたトーン）を保つ
- **変える意匠**: ページヘッダ新設（説明 + 「自動では消えない」案内）/ カテゴリ見出しに件数バッジ / 空カテゴリはセクションごと畳む（空行を並べない）/ 復元をラベル付きの主導線ボタンに・完全削除をアイコンのみの控えめ表現にして**危険度の非対称を明確化** / loading = skeleton・error = 専用カード（再読込）/ busy 中は対象行にスピナー / 確認モーダルにカスケード警告を追記
- **使う既存部品**: Card（カテゴリの容れ物 + 空 / エラーカード）/ Button（secondary = 復元、danger = 完全削除・確認、ghost = 再読込）/ IconButton（行内操作）/ Modal（確認）/ Sidebar・BottomSheet はシェル側。Toast は使わない（操作後の再 fetch と行の消失そのものが視覚フィードバック）
- **新規に必要な部品候補**（列挙のみ・実装しない）:
  - `TrashCategoryGroup` — 件数バッジ付き・0 件なら畳むカテゴリセクション
  - `ConfirmDangerModal` — カスケード警告を内蔵した危険操作の確認モーダル（他の danger 操作にも転用可）
  - `RowBusySpinner` — 行内の処理中スピナー（busy 対象行の識別）

## 4. ClaudeDesign プロンプト

> 各プロンプトの冒頭に `_COMMON-CONTEXT.md` の水平線以降（v2 / 2026-07-05）を全文コピー済み（改変・要約なし）。
> 画面固有部は色をロール名（accent / danger / bg-primary 等）で指定し、hex の重複記載を避けている（正本は共通ブロックの表）。

### 4.1 Desktop 用

```text
## Life Editor — デザイン共通前提（全画面共通・v3 / 2026-07-05）

### プロダクト

- 「AI と会話しながら生活を設計・記録・運用するパーソナル OS」。利用者は作者本人のみ（N=1）の個人ツール
- Web アプリ（React + Tailwind）。**Desktop（幅 768px 以上・サイドバーシェル）と Mobile（768px 未満・ボトムタブシェル）で構造ごと分岐**する
- Desktop = 全機能。**Mobile = 閲覧（Consumption）+ 素早い記録（Quick capture）に限定**（フル機能の縮小版ではなく、責務を絞る）

### アプリシェル（画面の外枠。各画面はこの内側にデザインする — 2026-07-05 決定の目標構成）

- Desktop: 左サイドバー（展開 240px / 折畳 64px。背景はやや沈んだ subsidebar 色）+ メインコンテンツ。メインは通常、中央寄せ max-width 768px（Connect グラフや Kanban など全幅の画面もある）
- サイドバー本流 5 セクション: Schedule / Materials / Connect / Work / Analytics（アイコンは lucide 系統: Clock, Library, Network, Timer, BarChart3）
- サイドバー最下部のユーティリティ枠（本流から視覚分離）: Settings / Trash + フッター（コマンドパレット起動 ⌘K / ユーザー表示 / サインアウト）
- 画面上部の header タブ: Materials = Tasks / Notes / Daily / Tags、Schedule = Calendar / Routines、Analytics = Overview / Tasks / Work / Schedule、Connect = Graph / Backlinks。Work / Settings / Trash はタブなし単画面
- 各画面の header タブ行の右端に **rightSidebar（詳細パネル）の開閉トグルアイコン**（lucide: PanelRight。open 中は accent 文字 + accent-subtle 地の活性表示、closed 時はニュートラル）を置く。rightSidebar = 右端の幅 320px（min 240px・左端リサイズハンドル）・押し込み式パネル（overlay ではなくメイン領域が縮む。背景はサイドバーと同じ subsidebar 色 + 左 border、上部 48px に「詳細」ヘッダー + 閉じる X）。中身はセクション文脈の詳細・補助 UI（例: 選択中タスクの詳細 = タイトル / ステータス / 内容）。**Desktop 全画面に付ける**（タブなし単画面では画面最上部の右端に同アイコン）
- Mobile: 下部タブバー = **Schedule / Materials / Work / Analytics + "More"**（More はボトムシートで Connect / Settings / Trash。safe-area inset 対応）。header タブは Mobile ではセグメントコントロール等の小型表現で継承。**画面上部・セグメントコントロール行の左端にハンバーガー（lucide: Menu・36×36 の border 付きボタン）**を置き、タップで左から幅 320px の drawer（黒 30% スクリム）が開いて Desktop の rightSidebar と同一内容を表示する。ナビ用の More ボトムシートとは役割分離（More = ナビ / ハンバーガー = 詳細パネル）

### ブランドパレット — Lumen（Cobalt Ink + Mint 系譜）

ほぼモノクロのコバルトグレー neutrals + Lumen blue の主アクセント + ライトミントの差し色。

**Chrome / Accent / Semantic（light / dark でテーマ可変）**

| 役割                                         | Light                 | Dark                  |
| -------------------------------------------- | --------------------- | --------------------- |
| bg-primary（アプリ地色）                     | `#fafafa`             | `#16161a`             |
| bg-secondary                                 | `#f1f1f3`             | `#1e1e23`             |
| bg-subsidebar（サイドバー地）                | `#f5f5f6`             | `#1e1e23`             |
| surface-sunken（沈んだ面）                   | `#ececef`             | `#101013`             |
| text-primary                                 | `#1a1a1f`             | `#f2f2f5`             |
| text-secondary                               | `#5c5c66`             | `#a0a0ad`             |
| text-tertiary                                | `#767680`             | `#74747e`             |
| border                                       | `#e3e3e7`             | `#2e2e35`             |
| border-strong                                | `#cfcfd6`             | `#44444d`             |
| accent（Lumen blue。主ボタン・選択・リンク） | `#1d4ed8`             | `#5b8cff`             |
| accent-hover                                 | `#1e40af`             | `#7aa2ff`             |
| on-accent（accent 上の文字）                 | `#ffffff`             | `#0a1024`             |
| accent-subtle（accent の薄塗り）             | `#dbeafe`             | `#21273f`             |
| hover（行ホバー等）                          | `#e8e8ec`             | `#2a2a31`             |
| accent-secondary（ミント差し色）             | `#1fa56e`             | `#5fd1a0`             |
| chip-mint bg / fg                            | `#daf3e7` / `#0c6f4e` | `#133024` / `#7fe0b3` |
| success                                      | `#0f7b6c`             | `#4dab9a`             |
| danger                                       | `#d92d20`             | `#ef4444`             |
| info                                         | `#2563eb`             | `#60a5fa`             |
| warning                                      | `#b45309`             | `#fbbf24`             |

**データ / 状態の符号色（light / dark 共通・テーマ固定）**

- ステータスバンド: todo `#38bdf8` / progress `#eab308` / done `#10b981`（カード左端 4px バンド等）
- エンティティ別チップ: task = Lumen blue 系（bg `#dbeafe` fg `#1e40af`）/ routine = 藍（bg `#ebf0fe` fg `#3b5bdb`）/ event = 紫（bg `#f3e8ff` fg `#6d28d9`）/ completed = 緑（bg `#ecfdf5` fg `#047857`）/ progress = 琥珀（bg `#fef6e0` fg `#a06b09`）
- グラフ カテゴリ 10 色: `#2563eb` `#22c55e` `#f59e0b` `#ef4444` `#8b5cf6` `#ec4899` `#06b6d4` `#84cc16` `#f97316` `#6366f1`
- スケジュールブロック地: routine `#ebf0fe` / event `#f3e8ff`（border `#8b5cf6`）/ その他 `#f1f2f4`

### 形・余白・文字

- フォント: システムフォントスタック（-apple-system / Segoe UI 等）。ベース 16px。サイズ段階は xs / sm / base / lg / xl の 5 段
- 角丸: 6 / 8 / 12 / 16 px + 完全円。余白: 4px 基調のスケール（4 / 8 / 12 / 16 / 20 / 24）
- 影: elevation 3 段（sm / md / lg）。控えめに。フラット寄りの Notion ライクな密度感

### 守るべきルール（不変式）

1. **上記パレットの色のみ使用**。新しい hex を発明しない（必要なら「トークン追加の提案」として明記する）
2. **主要コンテナ（カード / メニュー / ダイアログ / パネル / ポップオーバー）の背景は完全不透明**。backdrop-blur 不使用。モーダル背後の黒 30% バックドロップだけ許容
3. **light / dark 両テーマを必ず作る**。dark は pure black ではなく `#16161a`。light は pure white ではなく `#fafafa`
4. 本文テキストのコントラストは **WCAG AA（4.5:1）以上**
5. **状態を色だけで伝えない**（ラベル・形・バンドを併用）
6. **テキストは日本語の現実的なサンプルで組む**（英語より 1.2〜1.5 倍の幅を想定。UI は日英切替があるため極端な幅依存レイアウトを避ける）
7. 既存部品の意匠を踏襲する: Button / Card / Sheet（ドロワー）/ BottomSheet / Menu / Toast / Sidebar / CommandPalette / Kanban カード（左端ステータスバンド 4px）/ MasterDetail（一覧+詳細の 2 枚組）は既に存在する。ゼロから発明せず、この部品語彙で組む

### 成果物フレーム（全画面共通）

- **Desktop: 1440×900**（light / dark の 2 枚。左サイドバー展開状態込み）
- **Mobile: 390×844**（light / dark の 2 枚。下部タブバー込み・safe-area 考慮）
- 各画面につき: **通常状態（データあり）+ 空状態 + ローディング**、該当があればエラー状態も

---

## この画面: ゴミ箱（Trash）（Desktop 1440×900）

左サイドバーは展開状態。本流 5 セクション（Schedule / Materials / Connect / Work / Analytics）とは視覚的に分離された最下部のユーティリティ枠で「Trash」（Trash2 アイコン）がアクティブ。同じ枠に「Settings」が並ぶ。メインコンテンツは中央寄せ max-width 768px の単一縦カラム。日常的に使う画面ではなく「消したものを戻す・掃除する」低頻度の窓口なので、本流セクションほどの視覚的な重みは持たせず、実務的で落ち着いたトーンにする。

### ページヘッダ

- h1「ゴミ箱」+ 説明 1 行「削除した項目はここから元に戻せます。自動では消えないので、不要なものは完全に削除してください。」（text-secondary）
- 見出し行の右端に全体件数「全 9 件」を text-secondary の小さめ表示で

### 本体: 5 カテゴリのグループ

削除済み項目を 5 カテゴリ（タスク / ノート / デイリー / ルーティン / イベント）にグループ分けして縦に積む。各グループ:

- カテゴリ見出し（font-medium・text-secondary の小さめラベル）+ すぐ右に件数バッジ（例「3」を bg-secondary 地の小さな pill・text-secondary）
- そのカテゴリの削除済み行を不透明カード（bg-primary 地に border + 角丸 12px + 影 sm）に収め、行間は border 色の区切り線（divide）
- 各行の構成: 左 = 項目名（text-primary・1 行 truncate）。右に操作 2 つを危険度の差が分かる非対称で配置する:
  - **「復元」= 主導線**。ラベル付きの secondary ボタン（RotateCcw アイコン + 「復元」テキスト）。安全な操作なので発見しやすく、手が届きやすい表現にする
  - **「完全削除」= 危険操作**。アイコンのみの控えめな danger の IconButton（Trash2。テキストは付けず aria ラベルのみ）。復元より一段引いた存在感にして、取り返しのつかない操作を主導線と同格に見せない
- サンプルデータ（現実的な日本語・カテゴリごとに件数バッジと一致させる）:
  - タスク（3）: 「確定申告の書類を集める」/「もう使わない週次レビューのテンプレ」/「古い買い物リスト」
  - ノート（2）: 「旧・部屋の模様替えメモ」/「重複したレシピの下書き」
  - デイリー（2）: 「2026-06-12」/「2026-05-30」（日付ラベル）
  - ルーティン（1）: 「毎朝のストレッチ（旧版）」
  - イベント（1）: 「キャンセルした歯医者の予約」

**空カテゴリの扱い**: 削除済みが 0 件のカテゴリは見出しごと畳んで表示しない（空セクションを 5 個並べない）。通常フレームでは 5 カテゴリすべてにデータがある状態を主に見せ、別バリエーションとして「一部カテゴリのみデータあり」（例: タスク 2 件・ノート 1 件だけで、他 3 カテゴリはセクションごと消える）も 1 枚示す。

### 完全削除の確認モーダル（重要な状態・別フレームで提示）

「完全削除」を押すと確認モーダルを開く（背後は黒 30% バックドロップ・パネルは不透明）:

- タイトル「完全に削除」
- 本文「『確定申告の書類を集める』を完全に削除します。この操作は取り消せません。」+ カスケードのある項目（タスク等）では警告アイコン添えで追記 1 行「関連する子項目やタグの割り当ても一緒に削除されます。」（warning 色のアイコン + text-secondary の文言。色だけに頼らずアイコンと文で伝える）
- ボタン: 右下に「キャンセル」（secondary）と「完全に削除」（danger）。初期フォーカスはキャンセル側に置く

### 状態バリエーション（画面全体）

- 通常: 上記のデータ入り（5 カテゴリ）
- 全体が空: 削除済みが 1 件もない。中央に控えめな空状態カード — Trash2 アイコン（大・text-tertiary）+「ゴミ箱は空です」+ 補足「削除した項目がここに表示されます」。埋め草の装飾はしない
- ローディング: カテゴリ 2〜3 枚ぶんの行スケルトン（見出しバー + 行プレースホルダの角丸矩形、bg-secondary）に置き換えた 1 フレーム
- エラー: 読み込み失敗。中央に danger 寄りのカード「ゴミ箱を読み込めませんでした」+ ghost ボタン「再読み込み」
- busy（処理中）: 復元 or 完全削除の実行中は、対象行の操作ボタンを無効化し、その行に小さなスピナーを出す（連打で二重実行させないことを示す）。1 バリエーションとして「復元」を押した直後の行を処理中で示す

light / dark の両テーマで各 1440×900。dark は色の反転だけでなく、カードの border と divide 線でカテゴリの層が保たれるように。danger 色は dark では `#ef4444`。
```

### 4.2 Mobile 用

```text
## Life Editor — デザイン共通前提（全画面共通・v3 / 2026-07-05）

### プロダクト

- 「AI と会話しながら生活を設計・記録・運用するパーソナル OS」。利用者は作者本人のみ（N=1）の個人ツール
- Web アプリ（React + Tailwind）。**Desktop（幅 768px 以上・サイドバーシェル）と Mobile（768px 未満・ボトムタブシェル）で構造ごと分岐**する
- Desktop = 全機能。**Mobile = 閲覧（Consumption）+ 素早い記録（Quick capture）に限定**（フル機能の縮小版ではなく、責務を絞る）

### アプリシェル（画面の外枠。各画面はこの内側にデザインする — 2026-07-05 決定の目標構成）

- Desktop: 左サイドバー（展開 240px / 折畳 64px。背景はやや沈んだ subsidebar 色）+ メインコンテンツ。メインは通常、中央寄せ max-width 768px（Connect グラフや Kanban など全幅の画面もある）
- サイドバー本流 5 セクション: Schedule / Materials / Connect / Work / Analytics（アイコンは lucide 系統: Clock, Library, Network, Timer, BarChart3）
- サイドバー最下部のユーティリティ枠（本流から視覚分離）: Settings / Trash + フッター（コマンドパレット起動 ⌘K / ユーザー表示 / サインアウト）
- 画面上部の header タブ: Materials = Tasks / Notes / Daily / Tags、Schedule = Calendar / Routines、Analytics = Overview / Tasks / Work / Schedule、Connect = Graph / Backlinks。Work / Settings / Trash はタブなし単画面
- 各画面の header タブ行の右端に **rightSidebar（詳細パネル）の開閉トグルアイコン**（lucide: PanelRight。open 中は accent 文字 + accent-subtle 地の活性表示、closed 時はニュートラル）を置く。rightSidebar = 右端の幅 320px（min 240px・左端リサイズハンドル）・押し込み式パネル（overlay ではなくメイン領域が縮む。背景はサイドバーと同じ subsidebar 色 + 左 border、上部 48px に「詳細」ヘッダー + 閉じる X）。中身はセクション文脈の詳細・補助 UI（例: 選択中タスクの詳細 = タイトル / ステータス / 内容）。**Desktop 全画面に付ける**（タブなし単画面では画面最上部の右端に同アイコン）
- Mobile: 下部タブバー = **Schedule / Materials / Work / Analytics + "More"**（More はボトムシートで Connect / Settings / Trash。safe-area inset 対応）。header タブは Mobile ではセグメントコントロール等の小型表現で継承。**画面上部・セグメントコントロール行の左端にハンバーガー（lucide: Menu・36×36 の border 付きボタン）**を置き、タップで左から幅 320px の drawer（黒 30% スクリム）が開いて Desktop の rightSidebar と同一内容を表示する。ナビ用の More ボトムシートとは役割分離（More = ナビ / ハンバーガー = 詳細パネル）

### ブランドパレット — Lumen（Cobalt Ink + Mint 系譜）

ほぼモノクロのコバルトグレー neutrals + Lumen blue の主アクセント + ライトミントの差し色。

**Chrome / Accent / Semantic（light / dark でテーマ可変）**

| 役割                                         | Light                 | Dark                  |
| -------------------------------------------- | --------------------- | --------------------- |
| bg-primary（アプリ地色）                     | `#fafafa`             | `#16161a`             |
| bg-secondary                                 | `#f1f1f3`             | `#1e1e23`             |
| bg-subsidebar（サイドバー地）                | `#f5f5f6`             | `#1e1e23`             |
| surface-sunken（沈んだ面）                   | `#ececef`             | `#101013`             |
| text-primary                                 | `#1a1a1f`             | `#f2f2f5`             |
| text-secondary                               | `#5c5c66`             | `#a0a0ad`             |
| text-tertiary                                | `#767680`             | `#74747e`             |
| border                                       | `#e3e3e7`             | `#2e2e35`             |
| border-strong                                | `#cfcfd6`             | `#44444d`             |
| accent（Lumen blue。主ボタン・選択・リンク） | `#1d4ed8`             | `#5b8cff`             |
| accent-hover                                 | `#1e40af`             | `#7aa2ff`             |
| on-accent（accent 上の文字）                 | `#ffffff`             | `#0a1024`             |
| accent-subtle（accent の薄塗り）             | `#dbeafe`             | `#21273f`             |
| hover（行ホバー等）                          | `#e8e8ec`             | `#2a2a31`             |
| accent-secondary（ミント差し色）             | `#1fa56e`             | `#5fd1a0`             |
| chip-mint bg / fg                            | `#daf3e7` / `#0c6f4e` | `#133024` / `#7fe0b3` |
| success                                      | `#0f7b6c`             | `#4dab9a`             |
| danger                                       | `#d92d20`             | `#ef4444`             |
| info                                         | `#2563eb`             | `#60a5fa`             |
| warning                                      | `#b45309`             | `#fbbf24`             |

**データ / 状態の符号色（light / dark 共通・テーマ固定）**

- ステータスバンド: todo `#38bdf8` / progress `#eab308` / done `#10b981`（カード左端 4px バンド等）
- エンティティ別チップ: task = Lumen blue 系（bg `#dbeafe` fg `#1e40af`）/ routine = 藍（bg `#ebf0fe` fg `#3b5bdb`）/ event = 紫（bg `#f3e8ff` fg `#6d28d9`）/ completed = 緑（bg `#ecfdf5` fg `#047857`）/ progress = 琥珀（bg `#fef6e0` fg `#a06b09`）
- グラフ カテゴリ 10 色: `#2563eb` `#22c55e` `#f59e0b` `#ef4444` `#8b5cf6` `#ec4899` `#06b6d4` `#84cc16` `#f97316` `#6366f1`
- スケジュールブロック地: routine `#ebf0fe` / event `#f3e8ff`（border `#8b5cf6`）/ その他 `#f1f2f4`

### 形・余白・文字

- フォント: システムフォントスタック（-apple-system / Segoe UI 等）。ベース 16px。サイズ段階は xs / sm / base / lg / xl の 5 段
- 角丸: 6 / 8 / 12 / 16 px + 完全円。余白: 4px 基調のスケール（4 / 8 / 12 / 16 / 20 / 24）
- 影: elevation 3 段（sm / md / lg）。控えめに。フラット寄りの Notion ライクな密度感

### 守るべきルール（不変式）

1. **上記パレットの色のみ使用**。新しい hex を発明しない（必要なら「トークン追加の提案」として明記する）
2. **主要コンテナ（カード / メニュー / ダイアログ / パネル / ポップオーバー）の背景は完全不透明**。backdrop-blur 不使用。モーダル背後の黒 30% バックドロップだけ許容
3. **light / dark 両テーマを必ず作る**。dark は pure black ではなく `#16161a`。light は pure white ではなく `#fafafa`
4. 本文テキストのコントラストは **WCAG AA（4.5:1）以上**
5. **状態を色だけで伝えない**（ラベル・形・バンドを併用）
6. **テキストは日本語の現実的なサンプルで組む**（英語より 1.2〜1.5 倍の幅を想定。UI は日英切替があるため極端な幅依存レイアウトを避ける）
7. 既存部品の意匠を踏襲する: Button / Card / Sheet（ドロワー）/ BottomSheet / Menu / Toast / Sidebar / CommandPalette / Kanban カード（左端ステータスバンド 4px）/ MasterDetail（一覧+詳細の 2 枚組）は既に存在する。ゼロから発明せず、この部品語彙で組む

### 成果物フレーム（全画面共通）

- **Desktop: 1440×900**（light / dark の 2 枚。左サイドバー展開状態込み）
- **Mobile: 390×844**（light / dark の 2 枚。下部タブバー込み・safe-area 考慮）
- 各画面につき: **通常状態（データあり）+ 空状態 + ローディング**、該当があればエラー状態も

---

## この画面: ゴミ箱（Trash）（Mobile 390×844）

下部固定 4 タブ（Schedule / Materials / Work / Analytics）+ More のシェル。Trash は固定 4 タブに入らないため、More のボトムシート（Connect / Settings / Trash）から開かれた後の**全画面表示**としてデザインする。上部に「ゴミ箱」のシンプルなヘッダ（左に閉じる / 戻る導線）。safe-area（上下）を考慮する。

### Mobile の責務（Desktop との差分）

- **構造分岐は不要・機能は落とさない**。Trash は「削除した項目を確認して戻す」Consumption 寄りの窓口なので、Desktop と同じ「カテゴリ別グループ + 行 + 復元 / 完全削除 + 確認」をレスポンシブ単一カラムに素直に流すだけでよい。埋め草の要素を足さず、逆に機能を削らない
- Desktop から変えるのはレイアウトの詰め方とタップ領域だけ: カードはフルワイド（画面左右 16px マージン）、行の操作はタップしやすいサイズにする（各ボタンのタップ領域 44px 以上）

### 本体

- Desktop と同じ 5 カテゴリ・同じサンプルデータ・同じ件数バッジ:
  - タスク（3）: 「確定申告の書類を集める」/「もう使わない週次レビューのテンプレ」/「古い買い物リスト」
  - ノート（2）: 「旧・部屋の模様替えメモ」/「重複したレシピの下書き」
  - デイリー（2）: 「2026-06-12」/「2026-05-30」
  - ルーティン（1）: 「毎朝のストレッチ（旧版）」
  - イベント（1）: 「キャンセルした歯医者の予約」
- 各行: 左 = 項目名（1 行 truncate）。右 = 「復元」（ラベル付き secondary ボタン・主導線）+ 「完全削除」（アイコンのみ danger・控えめ）。危険度の非対称は Desktop と同じ
- 0 件のカテゴリは見出しごと畳んで表示しない

### 完全削除の確認

- 画面下部からせり上がる BottomSheet 表現で確認する（背後は黒 30% バックドロップ・パネルは不透明）。本文は Desktop と同じく「『…』を完全に削除します。この操作は取り消せません。」+ カスケード項目には警告アイコン付きで「関連する子項目やタグの割り当ても一緒に削除されます。」。ボタンは「キャンセル」（secondary）/「完全に削除」（danger）を大きめタップ領域で縦 or 横並び

### 状態バリエーション

- 通常: 上記のデータ入り（5 カテゴリ）
- 全体が空: Trash2 アイコン（大・text-tertiary）+「ゴミ箱は空です」+ 補足「削除した項目がここに表示されます」の控えめな中央空状態
- ローディング: カテゴリ 2 枚ぶんの行スケルトン（角丸矩形、bg-secondary）にした 1 フレーム
- エラー: 「ゴミ箱を読み込めませんでした」+ ghost ボタン「再読み込み」の中央カード
- busy: 復元 / 完全削除の実行中は対象行のボタンを無効化し行内にスピナー（連打防止）

light / dark の両テーマで各 390×844。ボトムタブバーは不透明（bg-primary 地 + 上辺 border・safe-area inset）。
```

## 5. Acceptance Criteria（brief 自体の完成条件）

- [x] §4 の全プロンプトが自己完結している（リポジトリのパス・内部参照・「上記参照」が本文に無い）
- [x] `_COMMON-CONTEXT.md` の共通前提ブロック（**v2 / 2026-07-05**）が全プロンプトの冒頭に全文埋まっている（要約・改変なし）
- [x] Desktop / Mobile 両方のプロンプトがあり、フレーム仕様（1440×900 / 390×844・light / dark）が明記されている
- [x] 通常（データあり）/ 空 / ローディング / エラー状態の指示がある（busy・完全削除の確認モーダルも含む）
- [x] 表示データが日本語の現実的なサンプルで指定されている（5 カテゴリ × 現実的な削除済み項目）
- [x] Mobile の責務（構造分岐不要・機能は落とさずレイアウトのみ 1 カラム）が明記されている
- [x] §1-2 の引用が `file:line` 付きで実在する
- [x] frontmatter の Status / Section / Owner-chat / Branch が埋まっている

## 6. 生成後の運用メモ

- 分業: 生成 = claude.ai/design 側（ユーザーがプロンプト投入）/ Claude Code 側 DesignSync は同期専用 / 出荷 UI 化は `shared/src/components/` への移植（別計画）
- 移植先候補: `shared/src/components/TrashView.tsx` の改修（件数バッジ / 空カテゴリの畳み / 行スピナー / カスケード警告つき確認モーダル）+ `web/src/trash/TrashScreen.tsx`（loading skeleton / error カード + 再読込導線）。§3 の新規部品候補（TrashCategoryGroup / ConfirmDangerModal / RowBusySpinner）
- 要件との既知差分: 要件（`.claude/docs/requirements/tier-2-supporting.md:491,509`）は Tasks / Notes / Memos / Routines / Databases / Templates / ScheduleItems + CustomSounds を Trash 対象に挙げるが、現行 web（W2）が扱うのは 5 カテゴリ（tasks / notes / dailies / routines / events）。本デザインは現行実装の 5 カテゴリに合わせた（Databases / Templates / CustomSounds は web 未実装のため対象外）。一括完全削除・自動パージも要件では触れるが現行 web 未実装のため本デザインには含めない
- v2 準拠: 本 brief は `_COMMON-CONTEXT.md` **v2**（2026-07-05・Lumen accent `#1d4ed8`）を最初から埋め込んで作成したため、settings のような accent resync は不要
- 生成デザインへのフィードバックで本 brief の §4 を更新した場合、Status と履歴を追記する
