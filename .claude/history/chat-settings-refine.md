# HISTORY (chat-settings-refine)

### 2026-08-30 - #1174 merge 後のコンフリクト解消（PR #1223 / #1229）

#### 概要

#1218（#1174）が main に入った結果、同じ Settings 画面を触る #1182 / #1229 の 2 本が衝突した。指示どおり 3 本とも origin/main から独立に切っていたので想定内で、各 PR 本文に予告してあった箇所がそのまま当たった。両ブランチへ main を取り込み、手で解消して CI 相当をローカル全緑にしてから再 push（merge は P-001 でユーザー手番のまま）。

#### 変更点

- **衝突の中身**: #1174 が Appearance / Account / Tutorial / Reset の各カードを `{tab === "general" && (…)}` の内側へ 2 段インデントし直したため、同じカードの `labels={{…}}` や props を足した 2 本と行が重なった。i18n catalog は両側が `settings` 配下の末尾へ別々のキーを足していたための衝突で、和集合を取れば済む種類
- **PR #1223（#1182）**: `en/ja.json` は和集合（`tabs` / `placeholder` / `schedule` と `fontSizePreset*` / `fontSizePx` は互いに素）。`SettingsScreen.tsx` は main の構造を採り、こちらの寄与である 4 行のラベルだけを新しいインデントで移植した
- **PR #1229（#1200）**: 同じ Settings 画面に加えて `shared/src/index.ts` も衝突。main が #1197 で `passwordRecoveryRedirectUrl` を `authRedirectUrl` へ改名しており、こちらが直後に `deleteAccount` / `DELETE_ACCOUNT_FUNCTION` を足していたため。改名側を採って 2 つの export を並べ直した。`SettingsScreen.tsx` は **重複が生じる形の衝突**で、main 側に Account / Tutorial / Reset の 3 カードが `general` の内側として既に存在し、こちらの同じ 3 カードが下にもう一組残っていた。main 側を残して重複を落とし、#1200 の寄与（sign-out / delete のラベル 6 行と `onSignOut` / `onDeleteAccount`）を生き残った側の Account カードへ移植。`DeleteAccountDialog` はカテゴリ条件の外（モーダルなので正しい位置）
- **検証**: 2 ブランチそれぞれで CI `verify` の全ステップ（shared / web / desktop / mcp-server）と `docs-lint` をローカル全緑。GitHub 側も #1223 が緑（#1229 は push 直後で再走中）。#1229 の merge commit は main 取り込みで他レーンの tracker が混ざり pre-commit-tracker-guard が誤検知したので、unstage せず `[tracker-ok]` で通した（既知の運用）

### 2026-08-29 - Settings 3 課題を各ブランチで実装し PR まで（#1174 / #1182 / #1200）

#### 概要

settings レーンの open 3 件を「1 Issue = 1 ブランチ（origin/main 分岐）」で実装し、各ブランチで CI `verify` 相当をローカル全緑にしてから PR を開いた（merge は P-001 によりユーザー手番のため未実施）。3 本とも `web/src/settings/SettingsScreen.tsx` を触るので、指示どおり origin/main から独立に切った代償として Appearance カード周辺で手動 resolve が要る旨を各 PR 本文に明記した。

#### 変更点

- **#1174 → PR #1218（claude/settings-1174-settings-tabs）**: Settings を「カテゴリ」化。rightSidebar の面が外観プレビュー + Tips からカテゴリ一覧（General / Briefing / Schedule / Materials / Work / Analytics / Tips）に替わり、本文は 1 カテゴリずつ表示する。General は従来のカードを順序ごと保持。Schedule カテゴリが初のセクション別設定で、`useCalendarNav` の `useState("week")` ハードコードを `resolveInitialCalendarView()` 種まきに置換（startup-section pref と同じ形 = 純粋 resolver + lazy 初期化子。`normalizeDesktopView` を通すので退役済みの `list` / `time` でも描ける）。Tips はカテゴリではなく中央 Modal。5 つのセクション行はアイコンもラベル key も `sections.ts` registry 由来（サイドバー行と食い違えない）。新規 = `SettingsTabsNav` / `SettingsSchedule` / `useScheduleInitialView`
- **#1182 → PR #1223（claude/settings-1182-mobile-size-steps）**: 狭幅の文字サイズを 3 段階プリセット（step 3 / 5 / 8 = 14 / 18 / 22px）に。既存 1–10 スケール上の step なので setter も保存値も root px も不変で、Desktop はスライダーのまま。中央 = step 5 = アプリ既定。保存済みの任意値は px 距離で最寄りに寄せ、同点（16px / 20px）は可読性側へ切り上げ。px 表示はスライダー用の「18px (5/10)」と別ラベルに分けた（3 段階の横で 5/10 は嘘になる）。`touch` prop の意味を「サムを大きく」から「狭幅レンダリング」へ拡張
- **#1200 → PR #1229（claude/settings-1200-account-deletion）**: セルフ退会 + 狭幅のログアウト導線。ログアウトは Desktop サイドバー足元にしか無く、狭幅（ボトムタブ・サイドバー無し）では site data 消去以外に出口が無かったので Account カードへ移設。削除は 2 分割 — `public.delete_my_account()`（migration 0025・**SECURITY INVOKER** なので RLS が各 DELETE を呼び出し元に絞る）が public 配下を消し、Edge Function `delete-account` が service_role で `auth.users` の 1 行だけ消す。`auth.users` 向きの FK が 1 本も無い（実測）ため CASCADE は効かず一覧は手書きになるので、削除後に `pg_catalog` から `user_id` を持つ全テーブルを引き直して残行があれば **RAISE**（＝トランザクション巻き戻し＝全か無か。テーブル追加時に静かに残らない）。確認 UI は ConfirmDialog ではなく「自分のアドレスを打ち直す」ゲート（このアプリで唯一 Trash も undo も無い操作のため）
- **🛑 人手ゲート**: #1200 は `cd supabase && npm run db:push` → `supabase functions deploy delete-account` の 2 手が要る（新規シークレットは不要 — service_role は Supabase が Edge Function に自動注入）。`comm/decisions/chat-settings-refine.md` に `G-20260829-settings-1` として控えた（同ファイルは #1200 ブランチ上に載っている）。ゲート未実施でも削除ボタンが 500 で失敗するだけでデータは 1 行も消えない
- **テスト**: shared に `scheduleInitialView`（resolver の fallback）/ `mobileFontSizePresets`（対応付け + カードのコントロール入替）/ `deleteAccountDialog`（ゲートと許容ルール・busy ロック・backdrop 無効）、web に `settingsTabs`（行→本文の routing・Tips が本文を替えないこと）/ `settingsMobileFontSize`（狭幅版・既存 Settings スイートは全部 wide だった）/ `settingsAccountDeletion`（武装済み confirm 以外は `deleteAccount()` に届かないこと）
- **検証**: 3 ブランチそれぞれで CI `verify` の全ステップ（shared lint / build / typecheck:tests / test、web 同、desktop typecheck / test / build、mcp-server build / typecheck:tests / test）と `docs-lint` をローカル実行し全緑。実ブラウザ・実機確認は §7.4 に従い merge 後 chat-main 側（#1182 の px 値の詰めと #1200 の実退会 E2E がここに残る）
- **衝突対応**: 別セッション `connect-refine-a6` が同じ /goal を受けて本 worktree に入り、`claude/settings-1174-settings-tabs` を作って `SettingsScreen.tsx` / i18n を編集していた。SendMessage で名乗り合って解消（向こうが撤退）。先方の `SettingsTabsNav.tsx` / `SettingsSchedule.tsx` と barrel の export は revert せず引き継ぎ、`SCHEDULE_INITIAL_VIEWS` を足して整合させた

### 2026-08-28 - チュートリアルの初回自動開始と Settings 再実行導線（Issue #1123 / PR #1164）

#### 概要

#1122 で入ったツアー基盤（TourProvider / ステップ定義 / スポットライト / 進捗永続化）に、入口 2 つを配線した。初回起動での自動開始は host が `autoStart` を渡すだけ、Settings の「やり直す」は新規カードから `restart()` を叩くだけで、ツアーの状態は 1 つも増やしていない。ただし `autoStart` をそのまま入れると実害が出るので guard を 1 つ足した — アンカー探索はステップのセクションへ**遷移してからでないと**表示可否を判定できないため、`data-tour-id` がまだどこにも無い現在のアプリでは、無言でセクションを 2 つ渡り歩いて最後の場所にユーザーを置き去りにする。しかも host が道中の各セクションを `life-editor-last-section` に書くので、次回起動もその寄り道先が開く。

#### 変更点

- **web/src/AppProviders.tsx**: `TourProvider` に `autoStart`。完了・スキップの判定は Provider の永続状態（`useLocalStorage` は初期化子で同期的に読むので、スキップ済みのツアーがリロードで一瞬出ることはない）
- **shared/src/components/SettingsTutorial.tsx（新規）**: Reset カードと同じ形の純粋部品。`onRestart` は forward せず `() => onRestart()` で呼ぶ（クリックイベントが第 1 引数に流れ込むのを避ける）。完了・スキップ後はここが唯一の戻り道なので、条件表示にせず常設
- **web/src/settings/SettingsScreen.tsx**: Reset の上に配置し `useTourContext().restart` を接続。ツアーは必須 Provider なので `useShortcutConfig` のような null 分岐は無し
- **shared/src/context/TourContext.tsx**: 走行開始時のセクションと「遷移したか」を ref で覚え、**1 ステップも表示できずに終わった走行**だけ開始地点へ戻す。表示できたステップがある走行は最後のステップの場所で終わる（従来どおり）
- **i18n**: `settings.tutorial.{heading,description,button}` を en / ja 両方へ
- **DataService の文面について**: Issue は「進捗を DataService 経由で」と書いているが、基盤 PR が積んだ判断キュー `D-20260827-shared-fix-1` の A（localStorage 据え置き）が既定のまま。差し替え先は `useTourProgress.ts` 1 ファイル
- **テスト**: shared に auto-start 5 本（初回で開く / スキップ後は黙る / 完了後は黙る / 空振り走行は開始地点へ戻す / 歩いた走行は戻さない）、web に「Tutorial カード → `restart` だけが発火」1 本。戻す guard は無効化して実際に落ちることを確認済み
- **検証**: CI の `verify` ステップ全段（shared lint / build / typecheck:tests / 2598 tests、web lint / build / typecheck:tests / 855 tests、desktop typecheck / 7 tests / build、mcp-server build / typecheck:tests / 318 tests）と docs-lint をローカルで全緑。実ブラウザ確認は §7.4 に従い merge 後 chat-main 側

### 2026-08-16 - パスワード変更フォームに hidden username を追加（Issue #945 / PR #978）

#### 概要

Settings > Account のパスワード変更フォームが new-password 2 本だけでできていたため、パスワードマネージャが「どの保存済みエントリを書き換えるのか」を判別できず、保存を提案しないか別エントリを更新していた（Chrome は開くたびに DOM 警告）。`PasswordUpdateForm` に optional な `username` を足し、渡されたときだけ hidden / readOnly の `autocomplete="username"` 入力をフォーム先頭に描くようにした。#956（floor 12 への引き上げ）を取り込んだ main から分岐しており、同 PR の定数・catalog には触れていない。

#### 変更点

- **shared/src/components/PasswordUpdateForm.tsx**: `username?: string` prop 追加＋ hidden / readOnly / `name="username"` の `autocomplete="username"` 入力。渡されないときは要素ごと描かない（空 username は「空アカウント」に紐付いて無いより悪くなるため）
- **shared/src/components/SettingsAccount.tsx**: カードが既に必須 prop として持っている `email` をそのまま渡す（渡し忘れが型で起きない側）
- **shared/src/components/PasswordRecoveryCard.tsx + web/src/AuthScreen.tsx + web/src/App.tsx**: recovery link は先にサインインを済ませるので、App が握る session の `user.email` を `recoveryUsername` → `username` と流す。マネージャの保存済みパスワードが定義上必ず古いこの画面が、保存が一番効く場所
- **テスト**: `web/tests/settingsAccountCard.test.tsx` に「session のアドレスが hidden username として載る（hidden / readOnly も込み）」1 本、`web/tests/authScreenRecovery.test.tsx` に「recovery session のアドレスが渡る」「アドレスが無ければ入力ごと出ない」2 本。hidden 入力は目視で気付けないので、ブラウザが実際に読む属性 `input[autocomplete="username"]` を名指しで固定した
- **i18n / トークン**: 新規文言ゼロ・スタイルゼロ（hidden 入力のためレイアウト差分なし）
- **検証**: shared lint 0 errors / `tsc -b` OK / 2301 tests pass、web lint 0 errors / build OK / 480 tests pass。Chrome の DOM 警告が消えることの実機確認は §7.4 に従い merge 後 chat-main 側

### 2026-08-15 - テーマ切替カードの light / dark が区別できない不具合修正（Issue #887 / PR #905）

#### 概要

Settings のテーマ切替カード 3 枚（ライト / ダーク / システム）が同じ見た目で、選択中のモードを色から読み取れなかった。原因は色の値ではなく `lumen-*` 別名の**解決タイミング**。Tailwind は `@theme` の別名（`--color-lumen-bg: var(--color-bg-primary)`）を `:root` に出力するが、CSS カスタムプロパティの `var()` は**宣言された要素**で置換されるため、別名は root のテーマ色で確定し子孫はその確定値を継承する。カードの `data-theme` サブツリーは下敷きの `--color-*` を切り替えていたが、実際に塗りに使う `lumen-*` 側は解決済みだった（`data-theme` スコープ自体は正しく、ミニチュア設計も正しかった）。

#### 変更点

- **shared/src/styles/tokens.css**: 裸の `[data-theme]` 属性セレクタで `lumen-*` 別名を再宣言するブロックを追加（light / dark の両方に当たるので、各宣言はその要素でスコープに入っている `--color-*` を見て解決される）。レイヤー外に置いたので Tailwind が `@layer theme` の `:root` に出す同名定義にも勝つ。列挙はネストしたテーマで塗る 6 トークンのみ・全て `var()` 経由で色値のコピーはゼロ
- **shared/src/components/ThemePreviewCard.tsx**: ラベル左に lucide の昼/夜グリフ（`Sun` / `Moon` / `SunMoon`）を 14px で追加し、色以外の手がかりを一本持たせた（絵文字は不可 = Issue 明記）。ラベルは `min-w-0` で 3 列モバイルグリッドでも折り返せるように
- **ビルド後 CSS で実証**: `[data-theme]{--color-lumen-bg:var(--color-bg-primary);…}` が `@layer` の外に出力され、`.bg-lumen-bg{background-color:var(--color-lumen-bg)}` が使用箇所で引く形になっていることを `web/dist` の生成物で確認
- **テスト**: `shared/tests/tokensNestedTheme.test.ts` 新規（別名ブロックを落とすと無言で元の症状に戻るため tokens.css の宣言を固定。色値コピーの混入も検出）・`shared/tests/themePreviewCard.test.tsx` に 3 枚のグリフ差分とミニチュアの固定テーマ検査を追加
- **docs**: `.claude/rules/frontend.md` のデザイン規約に落とし穴を 1 行追加（`lumen-*` はネストした `data-theme` に追随しない／部分テーマで使うトークンは別名ブロックに足す）
- **検証**: shared lint 0 errors / `tsc -b` OK / 2152 tests pass、web lint 0 errors / build OK / 394 tests pass、`scripts/docs-lint.sh` OK。実ブラウザ確認は §7.4 に従い merge 後 chat-main 側
- **worktree**: 本レーンの worktree が `workspaces/life-editor/workspaces/life-editor/settings-refine` と二重ネストしている（過去の相対パス作成の名残）。リポジトリ**外**なので Orca の除外条件には当たらず実害はパス長のみと判断し、作り直さず作業した
