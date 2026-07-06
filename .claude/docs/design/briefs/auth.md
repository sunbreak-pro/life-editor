---
Status: Ready # Draft → Ready（ClaudeDesign 投入可）→ Generated（デザイン生成済み）。v2 共通ブロックを最初から埋め込んで作成（2026-07-05 に v3 へ同期済み）
Created: 2026-07-05
Section: auth
Owner-chat: design-auth
Branch: claude/design-auth
---

# Design Brief: Auth（ログイン / サインアップ）

> 目的: **この 1 ファイルだけで「ClaudeDesign に貼るプロンプト」とその根拠が完結する**こと。
> ClaudeDesign はリポジトリを読めないため、§4 のプロンプト本文は自己完結させる
> （リポジトリのパス・「上記参照」「§1 の通り」等の内部参照を本文に書かない）。

## 1. 画面要件ダイジェスト

- **目的 / 主ユースケース**: **未ログイン時に全画面で表示される、アプリの入口**。Supabase Auth の Email + Password でサインイン / サインアップする。認証に成功するとアプリのシェル（サイドバー付き本体）へ切り替わる。N=1 の個人ツールなので、集客・訴求のためのランディングではなく「自分が確実にログインできる」ことだけを目的にした最小構成。
  - Phase 1 は Email + Password のみ（`web/src/AuthScreen.tsx:9`）。confirm-email は OFF 前提で、サインアップすると即ログインする（`web/src/AuthScreen.tsx:5-7,27-31`）
  - 認証は `shared` の `signIn` / `signUp` を呼ぶ（`web/src/AuthScreen.tsx:2,20`）。成功後のセッション反映は App 側の認証リスナが担う（画面自身は遷移を持たない）
  - Cloud Sync は Desktop ↔ iOS 間で同じ状態を保つ双方向同期層で、この認証がその入口（`.claude/docs/requirements/tier-1-core.md:392-403`）。旧 Tauri 時代は「Web / 認証 UI はやらない」が non-goal だったが（`.claude/docs/requirements/tier-1-core.md:416`）、Web 移行で Supabase Auth の認証 UI を持つ方針に変わり、その最初の画面が本 AuthScreen
- **表示するデータ**: 入力フォームのみ。リスト・一覧データは無い。要素は ①モード（signIn / signUp）②メールアドレス ③パスワード（6 文字以上）④送信ボタン ⑤モード切替リンク。サンプルのメール値はユーザー本人の `fstprog@gmail.com`
- **主要操作**: signIn ⇔ signUp のモード切替（`web/src/AuthScreen.tsx:10,97-108`）/ メール・パスワード入力 / 送信（`web/src/AuthScreen.tsx:16-33`）/ パスワードマネージャ連携のための autocomplete（email / current-password / new-password を mode で出し分け `web/src/AuthScreen.tsx:58,70-72`）
- **Desktop / Mobile の責務分割**: **auth はシェル外の画面のため Consumption / Quick capture の区分に当てはまらない**（ログインは両デバイスで等しく必須）。したがって Desktop と Mobile で機能を削り分けない。**Desktop / Mobile とも「中央寄せカード + フォーム」の同一レスポンシブレイアウトで成立させ、構造分岐（サイドバーシェル ⇔ ボトムタブシェルのような分岐）は行わない**。違いは横幅への追従だけ（Desktop = 広いキャンバスの中央に固定幅カード / Mobile = 画面幅いっぱいに広がるカード + safe-area 考慮）

## 2. 現状 UI インベントリ

- **host 画面**: `web/src/AuthScreen.tsx:9`（単一 `form`。`min-h-screen` の bg 地に `flex items-center justify-center` で中央寄せ、`max-w-sm` のカード `web/src/AuthScreen.tsx:36-40`）
- **shared 部品**: 認証ロジックのみ（`signIn` / `signUp` を `@life-editor/shared` から import — `web/src/AuthScreen.tsx:2`）。UI 部品としての共有カードは未使用
- **特徴的 UI**:
  - タイトル + サブテキスト（"Life Editor — Web" / "Sign in to your account"・"Create a new account" — `web/src/AuthScreen.tsx:42-50`）
  - メール input（`type=email` / `autoComplete=email` / `focus:border-lumen-accent` — `web/src/AuthScreen.tsx:55-62`）
  - パスワード input（`type=password` / `minLength=6` / autocomplete を mode で出し分け — `web/src/AuthScreen.tsx:66-77`）
  - エラー表示（`role="alert"` の danger ボーダー枠テキスト — `web/src/AuthScreen.tsx:80-87`）
  - 送信ボタン（`bg-lumen-accent` / busy 時 disabled + "Working…" — `web/src/AuthScreen.tsx:89-95`）
  - モード切替ボタン（テキストリンク "Need an account? Sign up" / "Already have an account? Sign in" — `web/src/AuthScreen.tsx:97-108`）
- **状態の現状**: error（`role="alert"` で実装済み `web/src/AuthScreen.tsx:80-87`）/ busy（送信中はボタン文言 "Working…" + disabled `web/src/AuthScreen.tsx:14,91-94`）は実装済み。データ取得が無いため loading（データロード）と empty（一覧空）は該当なし
- **現状の課題**（デザインで良くしたい方向）:
  1. UI 文言が英語のみ（"Life Editor — Web" / "Sign in to your account"）。アプリ本体は日英切替がある前提なので、認証画面も日本語ベースに揃えたい
  2. ブランドの第一印象が弱い。プレーンなフォームだけで、Lumen blue + ミント差し色というプロダクトの色を最初に見せる場を活かせていない（ただし N=1 の個人ツールなのでヒーロー画像等のマーケ装飾は不要）
  3. signIn / signUp の現在地がテキストリンク 1 本だけで弱い。今どちらのモードかが一目で分かる表現が欲しい
  4. パスワードの表示 / 非表示トグルが無く、入力ミスに気付きにくい
  5. エラー文言が技術的（"No session returned. Confirm-email may be enabled — disable it for Phase 1." — `web/src/AuthScreen.tsx:28-30`）で、そのままでは利用者に出せない。人間向けの文言に置き換えたい
  6. パスワードの「6 文字以上」制約（`minLength=6`）がフィールド上に明示されておらず、入力前に分からない
  7. busy 状態がボタン文言の差し替えだけで、送信中であることの視覚（スピナー等）が弱い

## 3. デザイン方針（このセッションの提案）

- **残す意匠**: 中央寄せの単一カード / Email + Password の 2 フィールドだけの最小構成 / signIn ⇔ signUp のモード切替を 1 画面で完結 / エラーの即時インライン表示 / パスワードマネージャ前提の autocomplete。**マーケ的装飾（ヒーロー画像・大見出しのコピー・ソーシャルログインの羅列）は足さない**（N=1・Phase 1 は Email + Password のみ）
- **変える意匠**:
  - ブランドヘッダ新設（小さなロゴマーク + プロダクト名 + 1 行の説明）で第一印象に Lumen の色を効かせる
  - signIn / signUp をセグメントコントロール（2 分割トグル）にして現在地を明示
  - パスワードに表示 / 非表示トグル + 「6 文字以上」のヘルパーテキストを追加
  - エラー文言を利用者向けの日本語に置換
  - busy 状態にスピナー + 「処理中…」を追加
  - UI 文言を日本語ベースに
- **使う既存部品**: Button（primary = 送信 / ghost・link = モード切替）/ Card（フォームの容れ物・完全不透明）/ input フィールド意匠（focus で accent ボーダー）。**auth はシェル外なので Sidebar / BottomSheet / CommandPalette / Toast は使わない**（それらはログイン後のシェル部品）
- **新規に必要な部品候補**（列挙のみ・実装しない）:
  - `AuthCard` — ブランドヘッダ + モードトグル + フォームをまとめた認証専用カード
  - `PasswordField` — 表示 / 非表示トグルとヘルパーテキストを内蔵したパスワード入力
  - `SegmentedToggle` — signIn / signUp のような 2〜3 分割の相互排他トグル（他画面のフィルタにも転用可）

## 4. ClaudeDesign プロンプト

> 各プロンプトの冒頭に `_COMMON-CONTEXT.md`（v3 / 2026-07-05）の水平線以降を全文コピー済み（改変・要約なし）。
> auth はアプリシェルの外側の画面のため、プロンプト本文で「サイドバー / タブバーは描かない」ことを明示している。
> 画面固有部は色をロール名（accent / bg-primary 等）で指定し、hex の重複記載は避ける（正本は共通ブロックの表）。

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

## この画面: ログイン / サインアップ（Auth）（Desktop 1440×900）

**重要 — この画面はアプリシェルの外側**。未ログイン時に表示される全画面の入口で、サイドバーも header タブも下部タブバーも描かない。画面全体を bg-primary で塗り、その中央（水平・垂直センター）に認証カードを 1 枚だけ置く。ログイン後に初めて上記のサイドバーシェルが現れる、という位置づけ。

### 認証カード

- 幅 400px 目安の単一カード。bg-secondary 地 + border（border 色）+ 角丸 12px + 影 md。内側 padding 24px、要素間は縦 16px。完全不透明（背後は無地の bg-primary なので blur 不要）
- カード内の構成は上から: ①ブランドヘッダ ②モードトグル ③フォーム ④送信ボタン ⑤補助テキスト

### ①ブランドヘッダ

- 小さなロゴマーク（Lumen blue `#1d4ed8` の角丸 8px スクエア 32px に、白のペン / エディタを想起させる lucide 風アイコン。派手にしない）+ その右にプロダクト名「Life Editor」（text-primary・lg・semibold）
- その下に 1 行の説明「生活を設計・記録するあなたのワークスペース」（text-secondary・sm）
- ヒーロー画像・キャッチコピー・イラストは置かない（N=1 の個人ツール）

### ②モードトグル

- 「ログイン」/「新規登録」の 2 分割セグメントコントロール（横並び・等幅）。アクティブ側は accent-subtle の塗り + text-primary + 下線 or 枠、非アクティブは透明 + text-secondary。フレームでは「ログイン」をアクティブにする
- 現在どちらのモードかが一目で分かること（テキストリンク 1 本では弱いので置き換える）

### ③フォーム

- **メールアドレス**: ラベル「メールアドレス」（text-secondary・sm）+ input（高さ 40px・bg-primary 地 + border + 角丸 8px）。プレースホルダ「you@example.com」。フォーカス時は border が accent 色。入力済みフレームでは値「fstprog@gmail.com」を表示。パスワードマネージャが補完できる素直なメール欄として描く
- **パスワード**: ラベル「パスワード」+ input（同意匠）。右端に表示 / 非表示トグル（目のアイコン・text-tertiary、タップで切替）。input のすぐ下にヘルパーテキスト「6 文字以上」（text-tertiary・xs）。入力済みフレームでは ●●●●●●（マスク）と、表示トグル ON のフレームで平文の例「pass-9k2xq7」を見せる

### ④送信ボタン

- フル幅・accent 塗り + on-accent 文字・角丸 8px・高さ 44px。ラベルはモードに追従（「ログイン」/「新規登録」）
- hover は accent-hover

### ⑤補助テキスト

- モードトグルと重複するので、カード下の説明は最小に。signIn 文脈では「アカウントが無い場合は上部の『新規登録』から作成できます」程度の 1 行（text-tertiary・xs）に留める。「パスワードを忘れた」導線は Phase 1 に該当フローが無いため出さない

### 状態バリエーション（同一 1440×900 内に複数フレームを並べる or 別フレームで）

1. **通常（ログイン・空フォーム）**: 上記の初期状態。メール・パスワード未入力、送信ボタンは通常見え
2. **入力済み（新規登録・パスワード表示中）**: モードトグルが「新規登録」アクティブ、メール「fstprog@gmail.com」入力済み、パスワードは表示トグル ON で平文「pass-9k2xq7」、送信ボタンのラベルは「新規登録」
3. **エラー**: 送信ボタンの上に danger 枠のアラート帯（danger 色の border + 薄い danger 地 + 警告アイコン + 文言「メールアドレスまたはパスワードが正しくありません」）。入力値は保持。**色だけでなくアイコンと文言で伝える**
4. **送信中（busy）**: 送信ボタンが disabled 見た目（不透明度を落とす）+ 小さなスピナー + ラベル「処理中…」。入力欄は操作不可のトーン

light / dark の両テーマで各 1440×900。dark でもカードが bg-primary（dark）の地から border と影で浮いて見えること。accent は dark では `#5b8cff` になる。

## この画面の位置づけの注記（デザイナー向け・カード外に描かなくてよい）

auth はログイン後のシェル（サイドバー / タブ）を一切持たない独立画面。上の共通前提に書かれたサイドバーや header タブは **この画面には現れない**（ログイン後の全画面で使う枠の定義として共有しているだけ）。この画面では中央のカードだけが主役。
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

## この画面: ログイン / サインアップ（Auth）（Mobile 390×844）

**重要 — この画面はアプリシェルの外側**。未ログイン時の全画面で、下部タブバーは描かない（ログイン前なのでタブは存在しない）。**Desktop と構造は完全に同一**で、中央寄せのカード + フォームというレスポンシブな単一レイアウト。Desktop から機能を削るものは無い（ログインはどのデバイスでも同じ入力が要る）。違いは横幅への追従だけ。

### レイアウト（Desktop との違いはここだけ）

- 画面全体を bg-primary で塗る。カードは画面幅いっぱいに広がり、左右に 16px の余白。上下は safe-area inset を考慮し、垂直はやや上寄せ〜中央
- カード意匠は Desktop と同じ（bg-secondary 地 + border + 角丸 12px + 影 md、内側 padding 20px）
- ソフトキーボード表示でカードが隠れないよう、内容はスクロール可能にする

### カード内の構成（Desktop と同一・タッチ最適化のみ調整）

- ①ブランドヘッダ: Lumen blue のロゴマーク + 「Life Editor」+ 説明 1 行「生活を設計・記録するあなたのワークスペース」
- ②モードトグル: 「ログイン」/「新規登録」の 2 分割セグメント（フルワイド・各セグメント高さ 44px 以上）。フレームでは「ログイン」アクティブ
- ③フォーム:
  - メールアドレス: input 高さ 48px 以上。プレースホルダ「you@example.com」、入力済みフレームは「fstprog@gmail.com」
  - パスワード: input 高さ 48px 以上、右端に表示 / 非表示トグル（タップ領域 44px 以上）。下にヘルパー「6 文字以上」
- ④送信ボタン: フル幅・accent 塗り・高さ 48px 以上・角丸 8px。ラベルはモード追従
- ⑤補助テキスト: 「アカウントが無い場合は上部の『新規登録』から」1 行（text-tertiary・xs）

### Mobile の責務（Desktop から落とすもの）

- **削るものは無い**。auth はシェル外の入口画面で、Consumption / Quick capture の切り分け対象にならない（ログインは全デバイス必須で、入力項目も同じ）。Desktop と同じフィールド・同じモード切替を、幅だけレスポンシブに追従させる。埋め草の装飾も足さない

### 状態バリエーション

1. **通常（ログイン・空フォーム）**: 初期状態
2. **入力済み（新規登録・パスワード表示中）**: 「新規登録」アクティブ、メール「fstprog@gmail.com」、パスワード平文「pass-9k2xq7」表示中
3. **エラー**: 送信ボタン上に danger 枠のアラート帯 + アイコン + 「メールアドレスまたはパスワードが正しくありません」。入力値は保持（色だけに頼らない）
4. **送信中（busy）**: 送信ボタンが disabled 見た目 + スピナー + 「処理中…」

light / dark の両テーマで各 390×844。safe-area（上下）を塗り残し、カードは bg-primary（dark）でも border と影で浮くこと。accent は dark では `#5b8cff`。

## 補足（デザイナー向け・画面に描かない）

- 「空状態」「データ読み込み中のローディング」はこの画面には該当しない（一覧データを取得しないフォーム画面のため）。非同期の状態は送信中（busy）のみで、上の状態バリエーション 4 が該当する
- 下部タブバーはログイン後のシェルの部品で、この未ログイン画面には出さない
```

## 5. Acceptance Criteria（brief 自体の完成条件）

- [x] §4 の全プロンプトが自己完結している（リポジトリのパス・内部参照・「上記参照」が本文に無い）
- [x] `_COMMON-CONTEXT.md`（v3 / 2026-07-05）の共通前提ブロックが全プロンプトの冒頭に全文埋まっている（要約・改変なし）
- [x] Desktop / Mobile 両方のプロンプトがあり、フレーム仕様（1440×900 / 390×844・light / dark）が明記されている
- [x] 通常（データあり）/ 空 / ローディング状態の指示がある（この画面では 空・データ読込ローディングは非該当と明記し、非同期状態 = busy とエラー状態を網羅）
- [x] 表示データが日本語の現実的なサンプルで指定されている（メール `fstprog@gmail.com`・日本語 UI 文言）
- [x] Mobile の責務削減（何を出さないか = 構造分岐なし・削るものは無い旨を明記）が記載されている
- [x] §1-2 の引用が `file:line` 付きで実在する
- [x] frontmatter の Status / Section / Owner-chat / Branch が埋まっている

## 6. 生成後の運用メモ

- 分業: 生成 = claude.ai/design 側（ユーザーがプロンプト投入）/ Claude Code 側 DesignSync は同期専用 / 出荷 UI 化は `shared/src/components/` への移植（別計画）
- 移植先候補: `web/src/AuthScreen.tsx` の刷新 + §3 の新規部品候補（AuthCard / PasswordField / SegmentedToggle）を `shared/src/components/` に切り出す案（生成結果を見てから確定）
- **v2 ネイティブ**: 本 brief は最初から `_COMMON-CONTEXT.md` の v2（accent light `#1d4ed8` / dark `#5b8cff` 等）を verbatim 埋め込みしており、settings brief のような accent 再同期の負債は無い。v1 の旧 accent 系 hex（PR #135 以前のコバルト値・薄塗り・task チップ旧色）は §1〜§4 に一切含まない（完了前機械チェック済み）→ 2026-07-05: 共通ブロックを **v3**（rightSidebar + ハンバーガー追加）へ同期済み
- 要件との既知差分: 旧 Tauri 時代の Cloud Sync 要件は「Web / 認証 UI はやらない」を non-goal にしていたが、Web 移行で Supabase Auth の認証 UI を持つ方針に変わった。本 brief は現行 `web/src/AuthScreen.tsx`（Phase 1 minimal）に合わせている。ソーシャルログイン・パスワードリセット・メール確認フローは Phase 1 に無いため出さない
- 生成デザインへのフィードバックで本 brief の §4 を更新した場合、Status と履歴を追記する
