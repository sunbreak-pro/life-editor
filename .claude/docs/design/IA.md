---
Status: APPROVED（2026-07-05 ユーザー決定）
Created: 2026-07-05
Owner-chat: frontend (orchestrator)
---

# IA — ナビゲーション構成（デザイン fan-out の SSOT）

> 全 design brief（`briefs/*.md`）はこの**目標構成**を前提にデザインする。現行実装（web の 10 フラットセクション）とは意図的に異なる。変更時は本ファイル → `_COMMON-CONTEXT.md` → 各 brief の順で同期する。

## 決定事項（2026-07-05・ユーザー承認済み 4 点）

1. **サイドバーは本流 5 + ユーティリティ枠 2（Settings / Trash）の計 7 セクションに集約**（Materials 内は header タブ）
2. **Trash はサイドバー最下部のユーティリティ枠**（Settings と並置・ナビ本流から視覚分離）
3. **Mobile の下部固定 4 タブ = Schedule / Materials / Work / Analytics**（5 個目は More → ボトムシート）
4. **rightSidebar（詳細パネル）を全画面標準に追加**（2026-07-05 App Shell デザイン Turn 2 でユーザー指示: Desktop 全パネルに開閉アイコン / Mobile は左上ハンバーガー → drawer に同一内容。詳細 → 下記「rightSidebar」節）

## Desktop サイドバー

| 位置                 | セクション | header タブ（画面上部の水平タブ）  | lucide アイコン例 |
| -------------------- | ---------- | ---------------------------------- | ----------------- |
| 本流                 | Schedule   | Calendar（週グリッド）/ Routines   | Clock             |
| 本流                 | Materials  | Tasks / Notes / Daily / Tags       | Library           |
| 本流                 | Connect    | Graph / Backlinks                  | Network           |
| 本流                 | Work       | （タブなし・単画面）               | Timer             |
| 本流                 | Analytics  | Overview / Tasks / Work / Schedule | BarChart3         |
| 下部ユーティリティ枠 | Settings   | （タブなし・縦一列）               | Settings          |
| 下部ユーティリティ枠 | Trash      | （タブなし）                       | Trash2            |

- フッター: CommandPalette 起動（⌘K）/ ユーザー表示（email）/ サインアウト
- 展開 240px / 折畳 64px（アイコンのみ）は現行踏襲

## header タブの大枠（詳細は各 brief が肉付け・提案してよい範囲）

- **Schedule**: Calendar / Routines の 2 タブ。カレンダー台帳の管理 UI（現 `CalendarView`）を第 3 タブにするか Routines 内・モーダルに畳むかは D1 brief の提案に委ねる
- **Materials**: Tasks / Notes / Daily / Tags の 4 タブ。タブ間で「新規作成」導線の位置・リスト密度・空状態の意匠を統一する
- **Connect**: Graph 主タブ + Backlinks。Backlinks を独立タブにせず選択ノード時のサイドパネルに畳む案も可（D3 brief の提案に委ねる）
- **Analytics**: 現行 4 タブ（Overview / Tasks / Work / Schedule）を維持
- タブ UI 自体（形状・アクティブ表現）は D7 shell brief が定義し、各画面 brief はそれを参照する

## Mobile（Consumption + Quick capture）

- 下部固定 4 タブ: **Schedule / Materials / Work / Analytics** + **More**（ボトムシート: Connect / Settings / Trash）
- header タブは Mobile ではセグメントコントロール等の小型表現で継承（例: Materials 上部に Tasks|Notes|Daily|Tags）
- safe-area inset 対応・タブバー込みで 390×844

## rightSidebar（詳細パネル・2026-07-05 追加承認）

意匠の正 = ClaudeDesign project `c73cdbf4` / `App Shell.dc.html` Turn 2（フレーム 2a-2c）。旧 frontend の `RightSidebar.tsx` + `RightSidebarContext`（portal 方式）と `ios-additions.md` G-3（Mobile ハンバーガー → 左 Drawer に同一内容）が先行事例。

- **Desktop**: 全セクション画面の header タブ行右端に開閉トグル（lucide: PanelRight・28×28。open 中 = accent 文字 + accent-subtle 地）。パネル = 右端 **幅 320px（min 240px・左端 6px リサイズハンドル）** の押し込み式（overlay ではない）。背景は subsidebar 色 + 左 border、上部 48px に「詳細」ヘッダー + 閉じる X
- **中身**: セクション文脈の詳細・補助 UI を portal する枠。生成デザインの例 = タスク選択中の `TaskDetailPanel`（タイトル / ステータス / 内容）。**セクションごとの中身の設計は各画面 brief / 実装の将来 iterate に委ねる**（本 IA はトグル・枠の標準のみ固定）
- **Mobile**: セグメントコントロール行の左端にハンバーガー（lucide: Menu・36×36 border 付き）→ **左から幅 320px の drawer** に Desktop rightSidebar と同一内容 + 黒 30% スクリム。ナビ用 More ボトムシートとは役割分離（More = ナビ / ハンバーガー = 詳細パネル）
- **生成デザイン未定義の補完（実装・brief 側で解決する）**: ①タブなし単画面（Work / Settings / Trash）のトグル置き場 = 画面最上部の右端（orchestrator 補完標準・v3 共通ブロックに記載）②タスク未選択などの空状態 ③drawer の safe-area 処理 ④aria 属性（生成 HTML に一切無いため実装で必須補完）⑤パレット外 hex 2 色（`#bfdbfe` スケルトンバー / `#25252b` dark カード地）は実装では既存 lumen トークンへ丸める

## セクション外の画面

- **auth（ログイン / サインアップ）**: 未ログイン時の全画面。シェル外・中央寄せカード（D8）
- **CommandPalette / Toast / OfflineBanner**: 全画面共通のオーバーレイ。意匠は D7 shell が定義

## 廃止

- **Terminal**: 機能ごと廃止（以前に決定済み・2026-07-05 ユーザー再確認）。brief 対象外。`SectionId` の `terminal`、CLAUDE.md §2/§5/§8・`tier-1-core.md` の Terminal 記述は docs / 型の整理として別途除去する（本計画のスコープ外）

## 現行実装との差分（実装リファクタの見取り図・別計画）

| 現行（web 10 フラット）                       | 目標 IA                                   |
| --------------------------------------------- | ----------------------------------------- |
| tasks / notes / daily / tags が独立セクション | Materials 1 セクションの header タブ 4 つ |
| schedule 内で 3 view が同居                   | Calendar / Routines の header タブ        |
| trash が通常セクション                        | サイドバー下部ユーティリティ枠            |
| terminal（SectionId のみ・web 未実装）        | 廃止                                      |
| RightSidebar は旧 frontend のみ（web 未実装） | 全画面標準の詳細パネル + Mobile drawer    |

- 実装の再編（`MainScreen.tsx` のセクション再構成・`SectionId` 整理）は**生成デザイン確定後の別計画**。本ファイルはデザイン用 SSOT であり、コード変更を伴わない
