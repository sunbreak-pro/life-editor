---
Status: ACTIVE — 統合 SSOT（2026-06-07 確定。Web 移行に一本化）
Created: 2026-06-07
Owner-chat: main
Parent: (none)
Supersedes:
  - 2026-06-05-mobile-first-section-unification.md を「Schedule 以降」部分のみ凍結（Work/Materials は完了として温存）
Related:
  - 移行 SSOT: ../../../2026-05-04-cross-platform-migration.md（Web 移行の詳細正本 / Phase 1-5）
  - 2026-06-05-mobile-first-section-unification.md（frontend 見た目統一・FROZEN）
  - 2026-05-16-phase2-core-migration.md（Web Phase 2 S0-S7）
  - 2026-06-06-web-phase2-s8-realtime.md（S8 / PR #47 完了）
  - 2026-06-06-web-phase2-s9-mobile-responsive.md（S9 / PR #49 目視 fix-pack 残）
  - 2026-05-21-data-unification-items-meta.md（Data Unification レーン）
---

# Plan: Web/Desktop/Mobile Parity 統合ロードマップ（交通整理 SSOT）

> **この 1 枚で全体像が分かり、他の並行チャット/worktree を閉じても次に進める**ことを目的にした統合 SSOT。
> 複数ブランチで並行した「frontend 見た目統一」と「Web 移行」の 2 レーンを 1 本に束ね、**Web 移行を主軸に一本化**した決定の記録。
> 各レーンの詳細は既存計画書に委譲し、本書は **① 戦略決定 ② 横断現状 ③ 次アクション ④ 計画書/ブランチの終い方** を持つ。

---

## 0. なぜこの文書を作ったか（背景）

複数チャットがブランチ別に並行した結果、方針が分散した。本チャットで一度棚卸しし、事実を 2 回のサブエージェント調査で確定した。判明した核心:

- **2 つのアプリが並走している**: `frontend/`（Tauri 版・現行）と `web/`+`shared/`（Supabase 版・移行先）。**別ツリーなのでファイル衝突は無いが、Schedule 等は二重実装**。
- **`frontend/` は移行 SSOT で「Phase 5 で削除」と明記**。にもかかわらず「見た目統一」レーンが frontend を磨いていた（= 捨てる予定のコードへの投資）。
- **見た目統一の成果（Work/Materials 統一）は `shared/web` に 1 行も伝播していない**。frontend ローカルに閉じており、Phase 5 で frontend ごと消える。
- **`refactor/web-first-v2` ブランチは死んでいる**: main の祖先（独自コミット 0）、最終更新 2026-05-22。作業はすべて main に集約済み。移行 SSOT がこのブランチ名を「作業ブランチ」と書くのは古い。

---

## 1. 戦略決定（2026-06-07・ユーザー確定）

**Web 移行を主軸に一本化する。**

| 決定                 | 内容                                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **主軸**             | `web/`+`shared/`（Supabase）への移行（移行 SSOT が詳細正本）                                                                        |
| **frontend の扱い**  | 移行完成まで **現状維持（塩漬け）**。これ以上は磨かない                                                                             |
| **見た目統一レーン** | **Schedule 以降を凍結**（FROZEN）。Work(#50/#51) / Materials(#53) は完了済みのため巻き戻さず温存                                    |
| **知見の継承**       | 統一プレイブック（Mobile を正とした棚卸し・`<View variant>` パターン・「何を残し何を捨てるか」の判断）は **web 側の画面実装に流用** |

**根拠**: frontend の成果は web に伝播せず Phase 5 で消える。Tauri bridge 依存（9 ファイル）のため frontend コンポーネントはそのまま web に載らない。捨てるコードへの投資を止め、最終形（web）に直接効かせる。

---

## 2. 横断現状マトリクス（セクション × 2 アプリ）

「正本」= 最終的にどちらの実装が生き残るか。**web が将来の正**。

| セクション                               | frontend（Tauri・塩漬け）          | web（Supabase・主軸）                                                         | 状態 / メモ                                                                   |
| ---------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Tasks**                                | あり                               | あり（`web/src/tasks/` 2 ファイル）                                           | web 移植済                                                                    |
| **Schedule**                             | あり（統一は**設計のみ・凍結**）   | あり（`web/src/schedule/` 4 ファイル）                                        | **二重実装**。web 版が正。frontend 統一は着手しない                           |
| **Notes**                                | あり                               | あり（`web/src/notes/` 4 ファイル）                                           | web 移植済                                                                    |
| **Daily**                                | あり                               | あり（`web/src/daily/` 1 ファイル）                                           | web 移植済                                                                    |
| **WikiTags**                             | あり                               | あり（`web/src/wikitag/` 5 ファイル）                                         | web 移植済                                                                    |
| **Work**（タイマー/音楽）                | あり（統一**完了** #50/#51）       | **なし**                                                                      | frontend 固有セクション。web 未実装＝**移植仕様の参照元として統一成果を活用** |
| **Materials**（ファイル/Daily/Notes 束） | あり（dead code 整理**完了** #53） | **なし**（Daily/Notes は web に個別実装あり、Materials という束ね概念は無し） | frontend 固有のナビ構造                                                       |
| **Settings**                             | あり（未統一）                     | なし（Auth/SignOut のみ）                                                     | web 設定画面は未実装                                                          |
| Connect / Analytics                      | あり                               | なし                                                                          | Desktop 専用。Mobile 不在。parity 対象外                                      |
| Terminal                                 | あり（Desktop 専用）               | なし                                                                          | terminal-division（別リポ・Electron）で stdio MCP 接続                        |

> **構造のズレ（要設計）**: web は今 `tasks / schedule / notes / daily / wikitag` の**フラット構成**。frontend の 7 セクション UI（サイドバー + Work/Materials の束ね）とはナビ構造が違う。web を最終的にどのセクション/ナビ構造に揃えるかは **§4-4 の未決事項**。

---

## 3. 2 レーンの位置づけ（統合後）

| レーン                           | 旧担当                            | 現状                                                                    | 詳細計画書                                         |
| -------------------------------- | --------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------- |
| **レーンA: frontend 見た目統一** | feat/work-section-mobile-unify 他 | **FROZEN**（Work/Materials 完了で停止。Schedule/Settings は着手しない） | `2026-06-05-mobile-first-section-unification.md`   |
| **レーンB: Web 移行（主軸）**    | refactor/web-first-v2 → 今は main | **ACTIVE**                                                              | 移行 SSOT `2026-05-04-cross-platform-migration.md` |

レーンB の内訳（移行 SSOT 基準）:

- Phase 1（土台）✅ 完了（2026-05-16）
- Phase 2（コア移植 S0-S7 + S8 Realtime + S9 mobile）— S0-S8 完了、**S9 のみ目視 fix-pack 残**
- Phase 2↔3 間: Data Unification レーン（DU-G G2 進行中）
- Phase 3（Electron 包装）未着手 / Phase 4-5 未着手

---

## 4. 次アクション（Web 主軸・優先順位付き）

このチャット以降で着手する作業。**frontend の section-unification は含めない**（凍結）。

### 4-1. Web Phase 2 を閉じる（最優先・完了間近）

- **S9 モバイルレスポンシブの目視 fix-pack**を回す（pass 1 静的修正は #49 でマージ済み。残りは 👀 ユーザー目視で崩れを潰す）。
- これで移行 SSOT「Phase 2 完了判定」の最後の 1 項目が埋まる。
- 委譲先: `2026-06-06-web-phase2-s9-mobile-responsive.md`

### 4-2. Data Unification を閉じる

- **DU-G G2**: Notes/Daily の Unified write path 完全切替。
- 委譲先: `2026-05-21-data-unification-items-meta.md` + `2026-05-25-data-unification-g-notes-daily-unified.md`

### 4-3. Phase 3（Electron 包装）着手

- `desktop/`（electron-vite + electron-builder）で macOS 起動まで。`shared/` を mount するだけの薄い包装。
- 委譲先: 移行 SSOT Phase 3。

### 4-4. 【要設計・未決】web のセクション/ナビ構造を決める

- web に **Work（タイマー）/ Materials（ファイル）/ Settings 画面**が無い。frontend の 7 セクション構造へ揃えるか、Mobile 基準の構造にするかを決める。
- ここで**レーンA の棚卸し知見が活きる**: Work では「History/Music/FREE は削除、TaskSelector は維持」、Schedule では「週ビュー/Dual Column/CalendarTags/検索は削除」と仕様が確定済み。**web 実装時の "何を作り何を作らないか" の仕様書として流用**する。
- 新計画書化の候補（着手時）: `2026-NN-web-section-structure.md`。

### 4-5. （別フェーズ・据え置き）Routine の Events 派生再設計

- frontend/web どちらでも、Routine を Event 生成テンプレートとして 1 から作り直す再設計は本ロードマップ外。web 実装が Schedule に到達した時点で専用計画書化。CLAUDE.md §4.3 DU-F 整合。

---

## 5. 計画書の棚卸し（Status 是正と終い方）

調査で判明した「計画書 Status とコード実態のズレ」を是正する。コードの git log を正とする。

| 計画書                                                                      | 実態                                                        | 本ロードマップでの扱い                                                                                  |
| --------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `2026-06-05-mobile-first-section-unification.md`                            | Work/Materials 完了、Schedule 設計のみ                      | **Status=FROZEN** に変更。Schedule 設計は「web 移植仕様の参照元」として保全（捨てない）                 |
| `2026-06-06-web-phase2-s8-realtime.md`                                      | PR #47 マージ済・残務なし                                   | **Status=DONE** に変更 → `archive/` へ移動                                                              |
| `2026-06-06-web-phase2-s9-mobile-responsive.md`                             | PR #49 マージ済・**目視 fix-pack 残**                       | Status を「実装マージ済 #49 / 目視 fix-pack 残」に明確化（plans/ 維持）                                 |
| `2026-05-30-notes-folder-dnd-ux.md`（origin/feat/notes-folder-dnd-ux のみ） | PR #38 マージ済なのに In-Progress 残存                      | マージ済 → そのブランチごと archive 対象（main に無いので本チャットからは触れない＝ブランチ削除で解消） |
| `chat-work-mobile-unify.md`（tracker）                                      | 「Work 未完・PR 未作成」と**誤記**。実際は #50/#51 マージ済 | per-chat tracker は当該チャット領域。本書に「**git log #50/#51 が正**」と申し送り（直接編集しない）     |

---

## 6. ブランチ / worktree の整理（破壊的・ユーザー確認後に実行）

| 対象                                               | 状態                                                      | 推奨                                                                         |
| -------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `refactor/web-first-v2`（branch + worktree）       | **死んでいる**（main の祖先・独自コミット 0・2 週間放置） | **削除推奨**。失うものは無い。SSOT のブランチ名参照も「main に集約済」へ更新 |
| `feat/work-section-mobile-unify`（worktree）       | #50/#51 マージ済・tracker 古い                            | prune 可                                                                     |
| `feat/materials-section-cleanup`（worktree）       | #53 マージ済                                              | prune 可                                                                     |
| `feat/web-phase2-s8-realtime`（worktree）          | #47 マージ済                                              | prune 可                                                                     |
| `feat/web-phase2-s9-mobile-responsive`（worktree） | #49 マージ済・目視 fix-pack はここで継続 or main で       | 目視作業の置き場を決めてから prune                                           |
| `prototype/fix-schedule-esc-duplicate`（worktree） | #48 マージ済・申し送り commit 残                          | 内容確認後 prune                                                             |
| `docs/bash-tool-stability-rule`（worktree）        | clean                                                     | 用済みなら prune                                                             |

> 実削除は CLAUDE.md「破壊的 git 操作は実行直前に再確認」に従い、**ユーザー承認後**に 1 つずつ。

---

## 7. cleanup チェックリスト（本チャットで実施）

- [ ] 未コミットの Phase 2 Schedule 設計（70 行）を**保全コミット**（失うとどこにもバックアップ無し）
- [ ] `2026-06-05-mobile-first-section-unification.md` を **FROZEN** 化（凍結理由 + Schedule 設計の保全意図 + Worklog 追記）
- [ ] `2026-06-06-web-phase2-s8-realtime.md` Status=DONE → `archive/` 移動
- [ ] `2026-06-06-web-phase2-s9-mobile-responsive.md` Status 明確化
- [ ] 本ロードマップ + 上記を 1 コミットに（docs のみ・main）
- [ ] 移行 SSOT のブランチ名参照（`refactor/web-first-v2`）を「main に集約済」へ更新（別タッチ可）
- [ ] （ユーザー承認後）死にブランチ `refactor/web-first-v2` 削除 + マージ済み worktree prune

---

## Acceptance（本文書の完了条件）

- [ ] section-unification の Schedule 以降が凍結、Work/Materials は完了として温存と読み取れる
- [ ] frontend / web の横断マトリクスが最新の実装実態を反映
- [ ] 次アクションが Web 主軸で優先順位付き（S9 → DU-G → Phase 3 → web セクション構造）
- [ ] マージ済み計画書の Status が是正され、死にブランチ `refactor/web-first-v2` の去就が明記
- [ ] **本書 1 枚で、他チャット/worktree を閉じても次に進める**

---

## DB Migration Notes

なし（本書はロードマップ。DDL を持たない）。web 側作業（DU-G 等）の DDL は各計画書が管理し、「ローカル migration 先行 → ユーザー `supabase db push`」を踏む（CLAUDE.md §7.3）。

---

## References

- 移行 SSOT（Web 移行詳細）: `../../../2026-05-04-cross-platform-migration.md`
- frontend 統一（凍結）: `./2026-06-05-mobile-first-section-unification.md`
- Web Phase 2 コア: `./2026-05-16-phase2-core-migration.md`
- Data Unification: `./2026-05-21-data-unification-items-meta.md`
- worktree 規約: CLAUDE.md §7.4 / `./2026-05-24-multi-chat-worktree-policy.md`

---

## Worklog

- 2026-06-07: 初版。2 レーン（frontend 見た目統一 / Web 移行）の衝突を 2 回のサブエージェント調査で確定。`refactor/web-first-v2` が死にブランチ（main の祖先）と判明。frontend の統一成果が web に伝播していない事実を踏まえ、**Web 移行に一本化**をユーザー確定。section-unification を Schedule 以降 FROZEN（Work/Materials は完了温存）。横断マトリクス・次アクション・計画書/ブランチの終い方を集約し、本書を統合 SSOT に据えた。
