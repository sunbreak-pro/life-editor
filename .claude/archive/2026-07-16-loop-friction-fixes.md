---
Status: COMPLETED
Created: 2026-07-16
Completed: 2026-07-19
Branch: claude/docs-workspace
Owner-chat: docs-workspace
---

# Plan: Loop Friction Fixes — ループを回すための摩擦除去（2026-07-16 ユーザー要件）

> **親計画** = [`2026-07-15-briefing-loop.md`](./2026-07-15-briefing-loop.md)。位置づけ = 判定基準「改善: 朝 5 分・夜 5 分の妨げから直す」の適用第 1 弾 ＋ ループ成立の**前提工事**（F-1）。
> 本書は仕様と決定の正本。起票は chat-main（issue-dispatch）・実装は各担当 worktree・進捗追跡は各 Issue が持つ。

---

## Context

- 2026-07-15 に briefing-loop を正本化した直後、ユーザーから運用上の摩擦 6 件が提示された（docs-workspace チャットへの直接指示）
- 精査の過程で**ループの土台欠陥**が判明: **手書きの朝刊・夕刊は現状の Daily では成立しない**（→ 事実 1・F-1）。要件 1 は見た目の不便ではなく「閉じる・読む」の手動経路そのものの欠陥だった
- 同日の第 2 ラウンドで、ユーザーから「夕刊を朝刊と同じページに（ヘッダータブ切替・専用入力ページ）」が追加提案され、決定 7・F-6 として確定した（Daily へ飛んで書くより朝刊・夕刊をセットで扱うほうが自然、という動線の摩擦除去）

## 事実確認（2026-07-16 実測。file:line は本日時点）

1. **Daily 本文は平文 textarea**（`web/src/daily/DailyView.tsx:102`）・タイトルは日付固定の非編集 `<h1>`（同 `:96`）。一方、紙面パーサ `extractBriefing`（`shared/src/components/briefing/extractBriefing.ts:69`）は **TipTap JSON の `heading` ノード必須** — 平文の `朝刊` や `# 朝刊` は拾われない。つまり手書きの朝刊・夕刊は現状表示不能
2. Daily の型・DB（`DailyNode.content` = TipTap JSON string / `dailies_payload.content_json` jsonb）は元々リッチ形式を想定した設計。textarea 平文は JSON parse 失敗 → 生文字列として保存される運用実態（`shared/src/services/dailiesUnifiedMapper.ts:134-141`）
3. 旧スラッシュコマンド（見出し変換）は i18n カタログの死にキーのみ残存（`blockMenu` / `turnIntoItems` — 参照コードなし）。Notes には見出し 1〜3 対応の TipTap エディタが現存（`web/src/notes/RichTextEditor.tsx`）
4. **「今日の約束」= ScheduleItem（Event）**（`ds.fetchScheduleItemsByDate` — `web/src/briefing/BriefingScreen.tsx:81`）、**「今日のタスク」= TaskNode**（`ds.fetchTaskTree` — 同 `:82`）。実体が別モノ。朝刊は約束の完了トグル以外**全行読み取り専用**（`BriefingView.tsx:240-277` タスク行に interaction なし）
5. rightSidebar「今日の流れ」は Schedule と**同一の共有 provider** を読むため、コード上は編集が即時反映される作り（`shared/src/hooks/useScheduleItemsAPI.ts:250` optimistic 更新）。朝刊は自前 fetch + Realtime `syncVersion`（300ms debounce）での再取得（`BriefingScreen.tsx:102`）— Briefing と Schedule は同時表示されないため復帰時に再取得される設計
6. Note の Links は**本文の最下部**に全幅ブロックで配置（`shared/src/components/materials/NoteDetailPanel.tsx:225` の `linksSlot` ← `web/src/wikitag/LinkPanel.tsx`）。Notes の rightSidebar には既に**ノート一覧ナビ**が入っている（`web/src/notes/NotesView.tsx:880`）。mobile は Links 非表示
7. Analytics は nav 登録済み・実データ取得の生きた実装（`web/src/analytics/AnalyticsScreen.tsx` + `shared/src/components/Analytics/`）。tier-3 の文書上 Verdict は「凍結継続」で、コード側に凍結フラグはない

## 決定録（2026-07-16 ユーザー確定）

1. **Daily エディタ = Notes と同じ TipTap リッチエディタへ載せ替え**（見出し 1〜3・保存 = 既定設計どおりの TipTap JSON・DDL ゼロ）→ F-1
2. **朝刊の行操作 = 「名称の横に専用の移動ボタン」＋「名称タップ = 完了トグル（取り消し線）」**。名称タップで移動、にはしない。約束の完了トグルは現行動作を維持し、タスク行にも同型を新設 → F-2
3. **Note Links = rightSidebar の開閉パネルへ移設**（layout-standard v2 の「区切り線の下でパネル開閉」構造・ノート一覧と共存）→ F-3
4. **Claude の起動口 = 定時自動（briefing-loop Step 5）を先行**。アプリ内ボタンは後続候補（Desktop 限定・Electron 経由でローカル `claude` 起動・$0 維持。Claude API 直課金経路は Non-Goal のため不採用）→ 実装なし・briefing-loop 決定録 5 に記録
5. **名称変更は表示ラベル（i18n en/ja catalog）のみ**: 「タスク」→「Todo」・「約束」→「予定」。コード識別子・DB・SectionId は改名しない（全層改名はループに仕えない工事のため）→ F-4
6. **Analytics は破棄しない**: 現行デザイン維持・配線と開発は凍結・完成間近に再開（tier-3 の「凍結継続」Verdict を追認・明文化）→ 実装なし・tier-3 に記録
7. **夕刊の入力 UI = Briefing 内ヘッダータブ（朝刊 / 夕刊）の専用ページ**（同日第 2 ラウンドで確定）。専用ページは「Daily の夕刊セクションの専用編集ビュー」であり**保存先は Daily のまま**（新テーブル・新保存先なし）。気分（五段階）は夕刊セクション内のテキスト規約「気分: n/5」で保存（DDL ゼロ維持・専用列への昇格は Analytics 再開時に判断）→ F-6。briefing-loop 決定 1 の「新 UI ゼロ」部分を更新（保存規約は不変）

## 要件 → 対応マップ

| ユーザー要件                                      | 対応                                                                                         | 宛先候補（routing は chat-main）             |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 1. Daily で見出しが作れず視覚的に苦労             | **F-1** Daily TipTap 化（ループ前提工事・最優先）                                            | section:materials（Daily は Materials）      |
| 2. 朝刊からタスクを選択しにくい・Daily を読み返す | **F-2** 朝刊行の操作 ＋ 日付接続の本体 = schedule-redesign Step 2〜3（既存・重複起票しない） | briefing 担当 worktree なし → chat-main 采配 |
| 3. Note の Links が邪魔                           | **F-3** rightSidebar パネル化                                                                | section:materials（layout-standard v2 整合） |
| 4. Claude ループボタン                            | 決定 4（定時自動先行）— 新規実装なし                                                         | —                                            |
| 5. 約束/タスクの違い不明・名称変更・反映されない  | **F-4** ラベル改名 ＋ **F-5** 反映バグ検証                                                   | shared-fix [all] / type:bug（chat-main）     |
| 6. Analytics を破棄しないでほしい                 | 決定 6 — tier-3 追認・実装なし                                                               | —                                            |
| 7. 夕刊を朝刊と同じページに（タブ切替・専用入力） | **F-6** 夕刊専用ページ（F-1 依存）                                                           | briefing 担当 worktree なし → chat-main 采配 |

## F-1〜F-6 仕様

### F-1: Daily エディタの TipTap 化（ループ前提工事・最優先）

- Notes の `RichTextEditor`（TipTap・見出し 1〜3）を Daily に再利用。タイトルは日付固定のまま変更しない（「date IS the identity」設計を維持）
- 保存 = TipTap JSON（現行 mapper・DB の想定形式そのもの・DDL ゼロ）
- **後方互換必須**: 既存 Daily は平文 string で保存済み — 読み込み時に平文 → TipTap doc へ変換（改行 = paragraph 区切り）。保存は**ユーザーが編集して初めて** JSON 化する遅延方式を推奨（読むだけで一括変換しない）。変換失敗時は平文フォールバック表示でデータを壊さない
- IME gotcha（`e.nativeEvent.isComposing`）遵守・自動保存（onBlur commit 相当）の現行挙動を維持
- **AC**: Daily に「朝刊」/「夕刊」見出し＋段落を手書き → Briefing 紙面に表示される（extractBriefing が拾う）/ 既存の平文 Daily が壊れず表示・編集できる

### F-2: 朝刊の行操作（完了トグル ＋ 移動ボタン）

- 各行（今日の予定 = 約束・今日の Todo = タスク・持ち越し）の**名称の横に専用の移動ボタン**を追加 → 該当セクション（Schedule / Materials > Tasks）へジャンプ
- **名称タップ = 完了トグル（取り消し線）**: 約束は現行動作を維持・タスク行にも同型を新設
- **AC**: 朝刊から Daily を読み返さずに、行から直接該当アイテムへ移動できる。名称タップの完了動作が約束・タスクで一貫する

### F-3: Note Links の rightSidebar パネル化

- 現在地 = 本文最下部（`NoteDetailPanel` の `linksSlot`）。移設先 = rightSidebar の開閉パネル（ノート一覧の下・layout-standard v2 の「区切り線の下でパネル開閉」構造）
- v2 の共通部品が未完成でも `RightSidebarPortal` への追加で先行実装可
- mobile は現行どおり Links 非表示のまま（変更なし）
- **AC**: 本文エリアから Links が消え、rightSidebar でノート一覧と Links パネルが共存する

### F-4: 表示ラベル改名（タスク → Todo・約束 → 予定）

- i18n en/ja catalog のみ。コード識別子・DB・SectionId は不変
- 対象例: `briefing.scheduleTitle`（今日の約束 → 今日の予定）/ `briefing.tasksTitle`（今日のタスク → 今日の Todo）/ Materials の Tasks タブ表示 等 — 実装時に catalog を grep で全数確認
- docs 側の「約束」「タスク」記述は歴史的文脈を除き同一 PR で追随（docs-consistency §2 改名 sweep）
- 留意: 「予定」の語が既存のカレンダー文言と衝突しないか catalog 突き合わせ
- **AC**: UI 上の名称が Todo / 予定 に統一・sweep 済み

### F-5: Schedule 編集の反映バグ検証（type:bug）

- 症状（ユーザー報告）: カレンダーで約束の時刻を変更しても rightSidebar「今日の流れ」・朝刊に即反映されない
- コード読解では「今日の流れ」は共有 provider の optimistic 更新で即時反映される作り（事実 5）。朝刊はセクション復帰時 refetch ＋ Realtime（300ms debounce）で自癒する設計
- 要・実ブラウザ再現（chat-main・playwright）。再現すれば根治 Issue 化、再現しなければ「反映は復帰時 refetch ＋ 数百 ms」の仕様として記録して close
- **結果（2026-07-18 chat-main 実機確認・再現なし → 仕様として close）**: 時刻変更で「今日の流れ」（CalendarTab と同一 provider・optimistic）も朝刊（自前 fetch・syncVersion 待ち）も正しく追従することをユーザーが実ブラウザで確認。バグではなく設計どおりのため Issue 起票せず。機構 = 「今日の流れ」は共有 provider の optimistic で即時、朝刊は Realtime エコー（postgres_changes・300ms debounce）による syncVersion bump もしくは Briefing 復帰時の remount で追従（`SyncContext.tsx` / `BriefingScreen.tsx:105`）
- **AC**: 再現手順の確定 or 仕様として記録して close → ✅ 仕様として記録・close（再現なし）

### F-6: 夕刊専用ページ（Briefing ヘッダータブ・F-1 依存）

- Briefing の SectionHeader にタブ「朝刊 / 夕刊」を追加（Materials / Analytics と同じ HeaderTabs パターン）。初期タブは時刻で自動選択（夕方以降 = 夕刊。しきい値は実装 Issue で決定 — day-start-hour pref との整合を確認）
- 夕刊タブ = 1 日の締めページ。構成: ① リッチテキストフィールド（F-1 と同じ TipTap 部品 — Daily / Note と同じ書き味）② 現状の残り Todo（表示専用・生データ読み）③ 今後の予定（表示専用）④ 気分の五段階入力（★ タップ UI → テキスト規約「気分: n/5」として夕刊セクション先頭に書き込み）
- **保存 = DailyNode content の「夕刊」見出しセクション**（専用編集ビュー。新テーブル・新保存先なし・DDL ゼロ）。Daily 側から直接書いても同じ場所に落ちる（どちらから書いても正）
- 残り Todo・今後の予定は本文へ書き写さない（分析は Step 2 の `get_today_context` が生データを直接読む。本文に書くのはユーザー自身の振り返りだけ）
- **依存: F-1 先行必須** — 現行 Daily の平文 textarea と構造化書き込み（本ページ・MCP）が同じ Daily を触ると保存形式が衝突して壊し合うため
- briefing-loop Step 4（宣言 → 講評）の置き場になる想定。モバイルでも入力可（Quick capture の範囲・気分タップ ＋ ひと言で成立）
- **AC**: 夕刊タブで書いた内容が Daily の夕刊セクションとして保存され Daily 側でも読める / 気分行が規約どおり記録される / 残り Todo・今後の予定が表示される / 初期タブが時刻で切り替わる

## Scope (Touchable Paths)

```
.claude/docs/vision/plans/2026-07-16-loop-friction-fixes.md
.claude/docs/vision/plans/2026-07-15-briefing-loop.md      # 決定録 5〜6・Step 3 改訂・Risks・Worklog 追記のみ
.claude/docs/requirements/tier-3-experimental.md            # Analytics 決定 6 の追記のみ
.claude/comm/outbox/chat-docs-workspace.md                   # chat-main 宛起票依頼
```

実装コードの変更は各 Issue のスコープで宣言する（本書のスコープに含めない）。

## Steps

| #   | Step                                                                                 | Gate                |
| --- | ------------------------------------------------------------------------------------ | ------------------- |
| 1   | 本書作成 ＋ 関連 docs 追随 ＋ outbox 起票依頼                                        | 🤖（本 PR）         |
| 2   | chat-main 起票（F-1〜F-6）                                                           | 🛑（chat-main）     |
| 3   | 各 worktree 実装 → close                                                             | 🤖 / 👀（各 Issue） |
| 4   | F-1 完了後: 手書きの朝刊・夕刊で 1 周を実測（briefing-loop AC の手動経路が開通する） | 👀                  |

## Acceptance Criteria

- [x] F-1〜F-6 の Issue がすべて close（F-5 は仕様記録での close・#258〜#263 全 CLOSED を 2026-07-19 gh 実測確認）
- [x] 夕刊タブから 1 日を閉じられる（F-6 の AC 一式・PR #274 merged 2026-07-18）
- [x] 手書きの「朝刊」「夕刊」見出しが Briefing 紙面に表示される（機構は F-1 TipTap 化 PR #270 merged 2026-07-18 で開通。**手書き 1 周の実ブラウザ実測は briefing-loop Step 6「平日 5 日連続ループ実測」へ引き継ぐ** — chat-main 担当）
- [x] 完了時: 本書 Status → COMPLETED ＋ archive 移動 ＋ per-chat memory 更新（2026-07-19 chat-main）

## Risks

- **F-1 後方互換**: 平文 Daily の変換バグは日記データの見かけ上の破壊につながる。読み込み時のみ変換・編集で初めて JSON 保存の遅延方式で、未編集データに手を触れない
- **F-4 用語重複**: 「Todo」は schedule-redesign の「本日の Todo トレイ」と用語が揃う（好都合だが sweep 時に混同注意）。「予定」はカレンダー既存文言との衝突を要確認
- **F-2 ジャンプ導線**: Materials > Tasks はセクション＋タブの 2 段状態を持つ — セクション切替とタブ指定を併せて渡す導線設計が実装 Issue で必要
- **F-6 の編集競合**: 夕刊ページと Daily 本体は同じ content を編集する — 夕刊セクションの書き込みは content 全体の読み出し → セクション差し替え → 書き戻しになるため、同時編集時に片方の入力が消えないようセクション単位のマージ書き込みを実装 Issue で設計する

## References

- 親: [`2026-07-15-briefing-loop.md`](./2026-07-15-briefing-loop.md)（ループ定義・判定基準）
- 関連: [`2026-07-14-schedule-redesign.md`](./2026-07-14-schedule-redesign.md)（要件 2 の「日付接続」の本体 = Step 2〜3）/ layout-standard v2（F-3 の rightSidebar 構造）
- 要件文書: `docs/requirements/tier-3-experimental.md`（決定 6 の記録先）

## Worklog

- 2026-07-16: 初版。ユーザー要件 6 件を実測精査（Explore 3 本 ＋ メイン spot check）し、AskUserQuestion で決定 1・3・4 を確定、決定 2 はユーザー詳細指定（名称横の移動ボタン ＋ 名称タップ = 完了トグル維持）。ループ土台欠陥（手書き朝刊が紙面に出ない）を発見し F-1 を最優先に設定。起票依頼 5 件を outbox へ
- 2026-07-16 (2): 同日第 2 ラウンド。ユーザー提案「夕刊を朝刊と同じページに」を精査し決定 7・F-6 として確定（保存先 = Daily のまま・気分 = テキスト規約）。briefing-loop の決定録 6 と Step 3 を改訂し、outbox の起票依頼に F-6 を追加
- 2026-07-19: **本書 COMPLETED 化（chat-main）**。F-1〜F-6 の Issue が全 close 済みであることを gh で実測確認（#258 F-1 / #259 F-2 / #260 F-3 / #261 F-4 / #262 F-5 = 仕様 close / #263 F-6 — 全 CLOSED）。対応 PR: F-1 = #270（merged 2026-07-18）・F-2 = #266・F-3/F-4 = #264・F-6 = #274（merged 2026-07-18）。INDEX 派生ビューが一部 PR を「open / merge 待ち」と古く表示していた stale を実態（全 merge・全 close）に是正。残る「手書き 1 周の実ブラウザ実測」は briefing-loop Step 6 へ引き継ぎ。archive/ へ移動
