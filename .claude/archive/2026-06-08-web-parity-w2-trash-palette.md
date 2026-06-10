---
Status: In Progress
Created: 2026-06-08
Branch: feat/w2-trash-command-palette
Owner-chat: main
Parent: ./2026-06-07-web-desktop-parity-roadmap.md
Previous: ./2026-06-07-web-parity-w1-ux-settings.md
---

# Plan: W2 — 即効2機能（Trash + CommandPalette）

> 親ロードマップ `2026-06-07-web-desktop-parity-roadmap.md` の **W2**。web を Desktop 同等へ引き上げる横断レーンの2本目。W1（PR #63）とは独立（DB 変更ゼロ・origin/main から分岐）。

---

## Context

- **動機**: web に Trash（削除済みの復元/完全削除）と CommandPalette（Cmd+K で機能横断ジャンプ）が無い。どちらも Tauri 依存ゼロ・難易度 S で即効性が高い。
- **制約**:
  - コスト $0・**DB 変更ゼロ**（soft-delete API は DataService に完備: `fetchDeletedTasks/Routines/ScheduleItems/NotesUnified/DailiesUnified` + 各 `restore*` / `permanentDelete*`）。
  - frontend/ は参照元（読むだけ）。**Trash は frontend 版を流用不可**（DU-G で消えた legacy context `useNoteContext`/`useDailyContext` 依存 + getDataService 直呼び）→ **純粋部品として書き直し**。
  - CommandPalette は frontend 版（195行）を i18n props 化してコピー（`useTranslation` 直呼び → 文言 props 注入）。
  - notion-\* トークン厳守・不透明背景。shared に ConfirmDialog は無い → **Modal で確認 UI を組む**。
  - **web は Provider をセクション別マウント**（MainScreen は tasks セクションに TaskTreeProvider… と個別）。Trash は5カテゴリ横断なので **host で DataService 直叩き**にする（section context に依存しない）。host が getDataService を呼ぶのは規約 OK（禁止はフック/部品内のみ）。
- **Non-goals**:
  - **sounds カテゴリの Trash**（Audio Provider が web 未導入 → W3 で対応）
  - **databases / templates の Trash**（web に UI 無し）
  - **全ショートカット実行 executor の本格配線**（W1 で設定 UI のみ実装済・押下実行は未配線）。W2 では **CommandPalette の Cmd+K は自前リスナで自己完結**させる。W1 ShortcutConfig との完全統合（rebind 済みキーで全機能起動）は任意 follow-up。

---

## Scope (Touchable Paths)

```
shared/src/components/CommandPalette.tsx     # 新規（frontend からコピー + i18n props 化）
shared/src/components/TrashView.tsx          # 新規（純粋部品・書き直し）
shared/src/components/index.ts               # barrel
shared/src/index.ts                          # barrel
shared/src/i18n/locales/en.json / ja.json    # 不足キーのみ追加（commandPalette/trash 系は既存の可能性大）
web/src/trash/TrashScreen.tsx                # 新規（host: DataService 直叩き + TrashView 配線）
web/src/MainScreen.tsx                        # trash section + nav + CommandPalette マウント + Cmd+K
.claude/docs/vision/plans/2026-06-08-web-parity-w2-trash-palette.md
```

**対象外**: frontend/（参照のみ）/ supabase/（DB 変更なし）/ desktop/ mobile/（未作成）/ 他チャット worktree / W1 のファイル（別 PR）。

---

## Steps

| #   | Step                                                                                          | Gate       | Acceptance                                             |
| --- | --------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------ |
| 1   | CommandPalette を shared へ（frontend コピー + `useTranslation` → 文言 props 注入）           | 🤖 自律    | `cd shared && npm run build` exit 0                    |
| 2   | web で Cmd+K グローバルリスナ + コマンド配列定義（section ジャンプ + Trash 起動）+ マウント   | 🤖→👀 目視 | Cmd+K で開く・絞り込み・↑↓Enter・section ジャンプ      |
| 3   | TrashView を shared に純粋部品として新設（grouped deleted + restore/permanentDelete props）   | 🤖 自律    | `cd shared && npm run build` exit 0・ダミー描画        |
| 4   | 確認 UI を Modal で（完全削除前の confirm）                                                   | 🤖 自律    | 完全削除で confirm Modal → 実行                        |
| 5   | web に TrashScreen（host: getDataService で5カテゴリ fetchDeleted + restore/permanentDelete） | 🤖→👀 目視 | 各カテゴリ一覧・restore で復活・permanentDelete で消去 |
| 6   | MainScreen に trash section + nav 追加・barrel export 整理・最終ビルド/lint                   | 🤖 自律    | shared/web build exit 0・web lint clean                |

### Gate 凡例

- 🤖 自律 = Claude 完結（型/test で品質担保）/ 👀 目視 = ユーザーが画面確認 / 🛑 人手 = 無し（W2 に DDL 等なし）

---

## Acceptance Criteria (機械検証可能)

- [ ] `cd shared && npm run build`（tsc -b）exit 0
- [ ] `cd shared && npm run test`（vitest）緑（CommandPalette フィルタ等にテストを足せれば）
- [ ] `cd web && npm run build` exit 0
- [ ] `cd web && npm run lint` clean
- [ ] PR diff が機能追加スコープ内（目安 +500 行程度）
- [ ] **目視**: Cmd+K で CommandPalette 開閉・絞り込み・↑↓Enter・section ジャンプ
- [ ] **目視**: Trash で5カテゴリ（tasks/notes/dailies/routines/events）の削除済み一覧表示
- [ ] **目視**: restore で項目が復活（該当 section に戻る）・permanentDelete で confirm → 消去

---

## DB Migration Notes

**不要**。soft-delete API は DataService に完備。新テーブル/カラムなし。

---

## Risks / Known Issues 参照

1. **TrashView は frontend 版流用不可**（legacy context 依存）。純粋部品として書き直し。host が DataService 直叩きで5カテゴリ取得。
2. **web の Provider はセクション別マウント** → Trash で section context を使おうとすると全部は揃わない。**host で DataService 直叩き**が正解。restore 後の section 反映はナビゲーション再 fetch / Sync realtime bump に委ねる（即時反映が要れば onChanged シグナルを検討）。
3. **CommandPalette の i18n**: `useTranslation` 直呼びを文言 props 注入へ。`Command` 型（icon?/label/action）も shared で export。
4. **Cmd+K の IME 衝突**: `e.nativeEvent.isComposing` チェック（CLAUDE.md §6.6）。入力欄での Cmd+K 横取りに注意。
5. **barrel 競合**: W1（PR #63 未マージ）も `shared/src/index.ts` / `components/index.ts` を編集。W2 が後でマージされる際に軽微な競合可能性 → 別領域への追記で最小化。
6. **worktree build 誤報**: worktree は node_modules を本体リンク（W0 deps install 済）。`npm install` 実行禁止。型エラー/テストで判定（memory `worktree_supabase_treeshake`）。
7. **既存 lean UI を壊さない**: MainScreen の section 分岐・per-section Provider nesting は触らず、trash section と CommandPalette マウントを足すだけ。SyncProvider は最外1回マウント維持。

---

## References

- 親ロードマップ: `.claude/docs/vision/plans/2026-06-07-web-desktop-parity-roadmap.md`
- 前フェーズ: `.claude/docs/vision/plans/2026-06-07-web-parity-w1-ux-settings.md`（PR #63）
- coding-principles §6（2層モデル: Trash/CommandPalette とも単純画面=レスポンシブ単一/単一モーダル）/ CLAUDE.md §6.4
- W2 参照元（読むだけ）:
  - `frontend/src/components/CommandPalette/CommandPalette.tsx`（195行・i18n props 化してコピー）
  - `frontend/src/components/Trash/TrashView.tsx`（構造参考のみ・legacy 依存で流用不可）
- DataService soft-delete API: `shared/src/services/DataService.ts`（fetchDeleted*/restore*/permanentDelete\* 完備）
- related skills: `add-component`, `frontend-react-designer`, `test-writing`

---

## Worklog

- 2026-06-08: role-pm 調査 + main 追加調査で要件確定。Trash は host で DataService 直叩き（web の per-section Provider 制約のため）。shared に ConfirmDialog 無し→Modal で確認 UI。sounds/databases/templates カテゴリは W2 スコープ外。worktree `w2-trash-palette` / branch `feat/w2-trash-command-palette` を origin/main `3f67082` から作成（W1 PR #63 とは独立分岐）。
- 2026-06-09: role-engineer 実装完了。**検証実測**（main が worktree で実測）: shared build (tsc -b) exit 0 / web build (tsc -b + vite build) exit 0 / shared test 328 passed (28 files・新規10件) / web lint 0 errors（既存 warning 1=変更外 `DebouncedTextInput.tsx`）。
  - **role-qa 独立監査 = PASS**（Critical/High/Medium 0）。5カテゴリ配線（tasks/notes/dailies/routines/events）を DataService 実装本体まで遡って1件ずつ照合し取り違えゼロ確認 / CommandPalette 純粋部品契約（useTranslation 非 import）/ IME ガード2箇所 / TrashScreen の race 安全（cancelled フラグ + busy ガード）/ notion-\* トークン全実在。
  - **Low 修正取込**: `TrashScreen.tsx` の dailies untitled フォールバックが未定義キー `noteTree.untitled` → 汎用 `common.untitled` を en/ja 両ロケールに新設して参照差し替え。
  - **W1 との関係**: 両者 `shared/src/components/index.ts` / i18n locales を触る。W1 PR #63 が先に merge された場合、W2 マージ時に i18n JSON で軽微な競合可能性（別領域追記で最小化済）。
  - **👀 ユーザー実機目視 待ち**: Cmd+K 開閉/絞り込み/↑↓Enter/section ジャンプ / Trash 5カテゴリ一覧 / restore で復活・permanentDelete で confirm Modal → 消去。
