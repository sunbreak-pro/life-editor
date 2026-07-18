---
Status: ACTIVE (adopted policy)
Created: 2026-07-15
Branch: claude/docs-workspace
Owner-chat: docs-workspace
---

# Plan: Briefing Loop — 開発の軸の正本（1 日 1 周ループ）

> **本書の役割**: briefing テーマの正本。コード内の「Briefing plan」参照（`shared/src/sections.ts` / `shared/src/components/briefing/extractBriefing.ts` 等）の実体は、これまでリポジトリ外の断片（2026-07-13 Cowork 引き継ぎ・`2026-07-14-schedule-redesign.md` §1・tier-1 注記）に散在していた — 本書に一本化する（2026-07-15 ユーザー決定）。
> **性格**: 実装計画そのものではなく「軸 + 判定基準 + ロードマップ索引」。個別実装の詳細は子計画書（例: schedule-redesign）と GitHub Issues が持つ。本書の Status は adopted policy として維持し、Step 完了ごとに Worklog へ追記する。

---

## Context

- **動機**: テーマが曖昧だと「便利だから足す」に戻り開発が発散する（過去に実績あり）。軸を 1 枚に書き、以後の機能の追加・改善・削除・凍結の全判断をこれに照らす
- **制約**: コスト $0（Claude API 直課金なし・Max サブスク / Cloud Routine の範囲内）/ DDL 最小（朝刊・夕刊とも dailies_payload 内のセクション規約で表現し新テーブルを作らない）/ N=1
- **Non-goals**: GCal 連携（凍結 — 再開条件は tier-1 / tier-3 に記載済み）・特化専用アプリ化・briefing の多人数向け配信

---

## 1. 中心思想 — 1 日 1 周のループ

**朝刊（読む）→ Schedule（組む）→ Work（没入する）→ 夕刊（閉じる）→ Claude 分析（翌朝刊を書く）→ …**

| 動詞   | 場所                            | 内容                                                                  |
| ------ | ------------------------------- | --------------------------------------------------------------------- |
| 読む   | Briefing セクション（ホーム面） | 今日の予定・Todo・持ち越し・フォーカス・AI 講評を「紙面」で読む       |
| 組む   | Schedule                        | タイムブロッキング（閲覧責務は朝刊へ移譲済み — schedule-redesign §1） |
| 没入   | Work                            | タイマー / ポモドーロで実行する                                       |
| 閉じる | Daily（Materials）              | 「夕刊」見出しの下に今日の気づき・学び・振り返りを書く                |
| 分析   | Claude（MCP）                   | 日記・メモ・実績を読み、翌朝の Daily に「朝刊」セクションを書き込む   |

---

## 2. 判定基準（追加・改善・削除・完成）

- **追加**: 上の 5 動詞のどれかに仕えるか。仕えないなら作らない
- **改善**: 「朝 5 分・夜 5 分で 1 周回る」を妨げているものから優先して直す
- **削除・凍結**: 数週間ループに登場しない機能は凍結候補（GCal・リマインダーの凍結は本原則の適用実績）
- **完成の定義**: 機能の網羅ではなく「**ループが平日 5 日連続で実際に回った**」こと（→ §Acceptance Criteria）

---

## 3. 決定録（2026-07-15 ユーザー確定）

1. **夕刊 = Daily 内「夕刊」見出しセクション**（朝刊と同じ規約・DDL ゼロ）。見出しテキストは「夕刊」（英 alias: Evening）。1 行でも成立とする（書くハードルを上げない）。当初の「新 UI ゼロ」は決定 6 で専用ページ方式に更新（保存規約は不変）
2. **Claude 分析の起動 = 定時自動路線（Cloud Routine）**。書き込み経路の設計は Step 5（前提 = Step 2 の MCP Supabase 化）。経路確定までの暫定運用は手動 `claude` 起動で可
3. **完成の定義 = ループが平日 5 日連続で回る**
4. **本書 = briefing テーマの正本**。ステップ番号は本書が正（コード・schedule-redesign の既存参照 Step 1 / Step 2(〜3) / ④宣言 と整合済み — `extractBriefing.ts` の「Step 2/3」は本書 Step 2 = write_briefing・Step 3 = 夕刊規約に対応。それ以外の旧番号はリポジトリ外断片のため本書で再定義）
5. **Claude 分析の起動口 = 定時自動（Step 5）を先行し、アプリ内ボタンは後続候補**（2026-07-16 ユーザー確定）。ボタンは Desktop 限定・Electron 経由でローカル `claude` 起動でのみ実現可（$0 維持。MCP は Claude → アプリ方向の口でありアプリから Claude は呼べない）。Claude API 直課金経路は Non-Goal のため不採用
6. **夕刊の入力 UI = Briefing 内ヘッダータブ（朝刊 / 夕刊）の専用ページ**（2026-07-16 ユーザー確定）。専用ページは「Daily の夕刊セクションの専用編集ビュー」で、保存先は決定 1 の Daily「夕刊」見出しセクションのまま（新保存先なし）。気分（五段階）はテキスト規約「気分: n/5」で夕刊セクション内に保存。仕様 = loop-friction-fixes F-6（F-1 = Daily TipTap 化に依存）

---

## 4. 現在地（2026-07-15 実測）

| 動詞   | 状況                                                                                                                 | 正本                                        |
| ------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 読む   | **出荷済み**（#249 — BriefingView + extractBriefing、ホーム面・デフォルト起動セクション）                            | コード（`shared/src/components/briefing/`） |
| 組む   | **進行中**（schedule-redesign Step 1 済み・Step 2〜7 残）                                                            | `2026-07-14-schedule-redesign.md`           |
| 没入   | 既存（Work セクション）                                                                                              | tier-1 / tier-2                             |
| 閉じる | **未着手**（本書決定 1 で規約は確定）                                                                                | 本書 Step 3                                 |
| 分析   | **未着手**（MCP schedule handler は旧 SQLite のまま Supabase 未接続・`get_today_context` / `write_briefing` 未実装） | 本書 Step 2                                 |

---

## Scope (Touchable Paths)

```
.claude/docs/vision/plans/2026-07-15-briefing-loop.md
.claude/CLAUDE.md                          # §8 Tier Map への Briefing 追記のみ
.claude/docs/requirements/tier-1-core.md   # §8 個数参照（6→7）の追随 1 行のみ
```

実装 Step のコード変更は各 Issue / 子計画書のスコープで宣言する（本書のスコープには含めない）。

---

## Steps（ロードマップ）

| #   | Step                                                                                                                     | Gate                          | Acceptance                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | ✅ Briefing セクション（読む面）                                                                                         | —（#249 merge 済み）          | 出荷済み                                                                                 |
| 2   | ⬜ MCP Supabase 化 + `get_today_context` / `write_briefing`（分析の配管。schedule-redesign 並走 α と同一起点）           | 🤖 実装 / 🛑 起票 = chat-main | 新ツールで今日の文脈が取得でき、Daily に朝刊セクションを書き込める（vitest + 手動 1 周） |
| 3   | ⬜ 夕刊規約の実装 — 入力 UI = Briefing 内「夕刊」タブの専用ページ（決定 6・loop-friction-fixes F-6・F-1 依存）           | 🤖 / 👀                       | 夕刊タブで書いた内容が Daily の夕刊セクションに保存され、翌朝の分析が拾う                |
| 4   | ⬜ 宣言（intentions）— 朝刊で今日の宣言 → 夕刊・翌朝刊で講評（schedule-redesign A-3「本日の Todo」トレイの最終形と合流） | 🤖 / 👀                       | 宣言 → 講評が 1 往復する                                                                 |
| 5   | ⬜ 定時自動化 — 毎朝の翌朝刊執筆を自動実行する経路の選定・設定（→ §Risks の経路候補）                                    | 🛑（経路選定・Routine 設定）  | 手を触れずに朝刊が届いた日が 1 日ある                                                    |
| 6   | ⬜ 完成判定 — 5 営業日連続のループ完走を実測                                                                             | 👀                            | §Acceptance の判定が 5 日連続で真                                                        |

---

## Acceptance Criteria

- [ ] **（完成判定）平日 5 日連続で、当日の DailyNode content に「朝刊」セクションと「夕刊」セクションの両方が存在する**（`get_daily` / DB クエリで機械判定可。組む・没入の実施は問わない近似でよい — 紙面が読まれ夕刊が書かれていればループは回っている）
- [ ] うち少なくとも 1 日は、朝刊セクションの執筆が Claude（`write_briefing` 経由）である
- [ ] 完了・supersede 時: 本書 Status と per-chat memory を更新した

---

## Risks

- **手書きの朝刊・夕刊は現状の Daily では成立しない**（Daily 本文が平文 textarea・紙面パーサは TipTap 見出しノード必須 — 2026-07-16 実測）。前提工事 = [`2026-07-16-loop-friction-fixes.md`](./2026-07-16-loop-friction-fixes.md) F-1（Daily の TipTap 化）。Step 2（MCP 書き込み）完了までは自動経路も未開通のため、**F-1 と Step 2 がループ開通の 2 大前提**
- **Cloud Routine はローカル MCP に接続できない**（クラウド実行）。Step 5 の経路候補: (a) ローカル定時実行（launchd/cron + `claude -p` ヘッドレス + ローカル MCP Server）(b) Cloud Routine + Supabase 直接書き込み。どちらも $0 で成立するが、(b) は items_meta の updated_at bump 等の書き込み整合を MCP を介さず守る設計が別途必要 → Step 2 完了後に判断する
- 夕刊が書かれない日が続くと分析の材料が涸れる → 決定 1 のとおり「1 行でも成立」を規約とし、書くハードルを上げない
- 朝刊の執筆品質（講評が的外れ・冗長）は運用で調整する領域 — プロンプト / Routine 指示の改善であり、アプリ機能で解決しない（判定基準「追加」に照らして UI を足さない）

---

## References

- 子計画書: [`2026-07-14-schedule-redesign.md`](./2026-07-14-schedule-redesign.md)（「組む」の正本。§1 中心思想は本書と同一のループ）/ [`2026-07-16-loop-friction-fixes.md`](./2026-07-16-loop-friction-fixes.md)（摩擦除去 F-1〜F-5。F-1 = Daily TipTap 化はループ手動経路の前提工事）
- コードの正: `shared/src/sections.ts`（briefing セクション定義・デフォルト起動）/ `shared/src/components/briefing/`（BriefingView / extractBriefing）/ `web/src/briefing/BriefingScreen.tsx`
- 要件: `docs/requirements/tier-1-core.md` §Briefing（2026-07-17 #257 で追加。CLAUDE.md §8 は本書をポインタとして参照）
- デザイン: `docs/design/briefs/` に briefing.md は未作成（紙面の意匠は当面 BriefingView の実装コメントが正）

---

## Worklog

- 2026-07-15: 初版。ユーザーとの話し合いで決定 1〜4 を確定し、リポジトリ外に散在していた朝刊ロードマップを本書へ一本化（docs-workspace チャット・ユーザー直接指示）。CLAUDE.md §8 に Briefing を追記。Step 2 以降の Issue 起票は chat-main へ outbox 経由で依頼
- 2026-07-16: role-qa 独立監査（事実主張 全 VERIFIED・Blocker 0・Should 1・Nit 2）を反映 — `tier-1-core.md` の「§8 の 6」個数参照を 7 に追随（数値の非複製原則の同一 PR sweep・Scope に 1 行追加）、決定 4 に `extractBriefing.ts` の「Step 2/3」表記との対応を補記
- 2026-07-16 (2): ユーザー要件 6 件（摩擦除去）を受けて子計画 [`2026-07-16-loop-friction-fixes.md`](./2026-07-16-loop-friction-fixes.md) を新設・決定録 5 を追記。手書き朝刊・夕刊が現状不成立（Daily 平文 textarea vs TipTap 見出しパーサ）の欠陥を Risks に記録（PR #253 は merge 済み — 本追記は後続 PR）
- 2026-07-16 (3): 決定録 6（夕刊の専用ページ化 — Briefing ヘッダータブ・保存先は Daily のまま）を追記し、Step 3 を専用ページ方式に改訂（ユーザー提案の採用。仕様 = loop-friction-fixes F-6）
- 2026-07-17: Issue #257 — `tier-1-core.md` に Briefing requirements 節を追加（本書を正本ポインタとして参照）。CLAUDE.md §8 の「requirements 節は追って追加」注記と本書 References の「未作成」記述を解消
