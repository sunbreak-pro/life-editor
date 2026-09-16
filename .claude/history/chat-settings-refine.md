# HISTORY (chat-settings-refine)

### 2026-09-16 - packaged 版の renderer を app:// で配信して端末ローカル設定を残す（#1636 / PR #1649）

#### 概要

packaged 版の Desktop を再起動するとテーマ・言語・チュートリアル進捗が既定へ戻っていた。原因は key の置き場ではなく **origin** で、`loadFile` が renderer を `file://` に置き、Chromium がそこでストレージを確実に永続化しないため。`app://bundle/` を standard + secure スキームとして登録し、同じバンドルをそこから配信して直した。merge は P-001 でユーザー手番のため未実施。

#### 変更点

- **方式 A（カスタムスキーム）を採用**: Issue が併記していた B（IPC storage adapter）は同じ結果を出すのに shared の localStorage 直読み（`ThemeContext` / `i18n` / `useTourProgress` / `useStartupSection` / `useScheduleInitialView` / `useReminderPrefs` / ショートカット）を非同期 adapter へ書き換える必要があり、波及が Provider の初期描画まで届く（テーマは初回ペイントで要る値なので await を挟むと既定テーマが一瞬見える）。A は原因そのものを消すので **`shared/` の差分ゼロ**で全部が一度に直る
- **#838 の認証ストレージは不変**: `app://` でも localStorage は平文なので、refresh token の置き場としては main + `safeStorage`（OS キーチェーン）が今も上位。IPC 3 本・store・preload の橋はそのままで、`main/index.ts` の該当コメントだけ「origin の問題は #1636 で直ったが暗号化の理由でここに残す」と現状に合わせた
- **新規 `desktop/src/main/appProtocol.ts`**: スキーム名・entry URL・`resolveBundlePath()`・`contentTypeFor()`。`claudeLauncher.ts` と同じ理由で index.ts から分けた（index.ts は `electron` を module scope で import するため、そこに置くと Electron を起動しないとテストできない）。`index.ts` 側は module scope で `registerSchemesAsPrivileged`（`standard` / `secure` / `supportFetchAPI` / `stream`）、`whenReady` で `protocol.handle`、prod の `loadFile` → `loadURL(APP_ENTRY_URL)`
- **前提が 1 つ実測で外れた**: 「URL パーサーは `%2e%2e` を畳まない」つもりでテストを書いたら 2 件落ちた。WHATWG の仕様では `%2e%2e` も double-dot segment に数えるのでパーサー側で消える。**実際に封じ込めチェックへ届く抜け道はスラッシュをエンコードした形**（`..%2f..%2f`）だけで、テストとコメントをその実測に合わせた。カスタムスキームのハンドラは main の権限で動くファイルサーバーなので、ここは飾りではなく本体
- **Content-Type は拡張子から明示**: module script が JavaScript 以外の型で返ると Chromium が拒否し、packaged 版だけ真っ白になる。`net.fetch` の Response は headers が immutable なので包み直している
- **origin の回帰ガード**: `desktop/tests/appProtocol.test.ts`（21 件）のうち 3 件は `main/index.ts` のテキスト比較。`loadFile` に戻しても型検査もビルドも dev 起動も全部通り、**packaged 版を終了した後にしか差が出ない**ため（`macTitleBar.test.ts` と同じ流儀）
- **renderer 側は無改造で通ることを確認**: `authRedirectUrl()` は protocol のホワイトリスト（`http:` / `https:`）判定なので `app:` でも公開 Web URL に落ちる。`legalUrl` の `pushState` は `file://` より `app://` の方が確実に動く。ビルド済み index.html の参照は全部 `./` 相対
- **検証**: CI `verify` の全ステップ + `docs-lint` をローカルで 15/15 緑（shared 308 files / 3124 tests・web 127 / 1185・desktop 4 / 57・mcp-server 31 / 455）。packaged ビルドでの再起動確認は実機操作なので PR に手順を書いて 🛑 ユーザー手番

#### 残件

`.claude/skills/add-ipc-channel/SKILL.md:24` が「パッケージ版の renderer は `file://` で動く」と書いており、この PR 以降は事実と食い違う。Issue の Scope 外なので触らず PR 本文に follow-up として明記した。

### 2026-09-07 - narrow 幅の TagEditModal と 44px タップ床（#1526 / PR #1563・#1562 / PR #1568）

#### 概要

#1409（Mobile 幅 390×844 の実ブラウザ点検）が拾った settings レーンの open 2 件を、1 課題 = 1 ブランチ（どちらも origin/main 分岐）で直して PR まで出した。どちらも `TagEditModal` を触るが、片方はヘッダー、もう片方は各ボタンの当たり判定で行は重ならない。merge は P-001 でユーザー手番のため未実施。

#### 変更点

- **#1526 → PR #1563**: タグ編集パネルに閉じるボタンが無く、Escape かスクリムでしか閉じられなかった。スマホでは物理キーボードが無く、スクリムはパネルの周りに数 px しか残らないので事実上出口が無い。ヘッダーを `Modal` の `title` に任せるのをやめ `TagEditModal` 側で組み、既存の `labelledBy` でダイアログ名を自分の見出しから取るようにした（`Modal` 自体に閉じるボタン機構を足すのは Scope 外）。ボタンは `size-11` の 44px 角で、負のマージンでヘッダー高さは据え置き。`DIALOG_AUTOFOCUS_SKIP` を付けて開いたときのフォーカスは従来どおり追加フィールドへ。`TagEditModalLabels.closeLabel` は必須にした（BottomSheet の `closeLabel` と同じ理由で、出口を読み上げられないパネルを型で作れなくする）。文言は既存の `common.close`
- **#1562 → PR #1568**（#1512 の settings レーン残件）: カテゴリ行 41 / ゴミ箱の一括・行ボタン 41 と一括選択チェックボックス 27 / TagEditModal の追加・保存・削除・戻る 32 と色 24 と外す 32×32 / AI 連携「一覧を開く」112×32 / 法務 reader「戻る」56×32 / 一般カード 7 本 41 を底上げ。**呼び出し側に条件付きで載せる**形（新トークン `CARD_BTN_TAP` = `max-md:min-h-11`）で、`Button` の size 表は不動（`size="md"` の 36px は Desktop 15 箇所に効く）。768px = `WIDE_BREAKPOINT_PX` なので `max-md:` と各コンポーネントの `wide` は同じ 1px で切り替わる
- **形が違った 2 つ**: ゴミ箱のグループチェックボックスは `wide` が**ハードコード**されており、隣の行チェックボックスが 44 なのに自分だけ 24 だった（同じフラグを読むよう修正）。`ColorPicker` は wikitag 行も同じ部品を描くので、部品を太らせず opt-in の `triggerClassName` を足して呼び出し側 1 つだけを上げた
- **テスト**: 新規 `shared/tests/settingsTapTargets.test.tsx`（14 件）+ `settingsAiIntegration.test.tsx` / `web/tests/legalReaderHost.test.tsx` に各 1 件 + 新規 `shared/tests/tagEditModalClose.test.tsx`（5 件）。jsdom にレイアウトが無いので実測ではなくサイズを生むクラス契約を pin し、**narrow の床と Desktop 据え置きを両方**固定した（`sharedTapTargets.test.tsx` と同じ流儀）
- **検証**: 2 ブランチそれぞれで CI `verify` の全ステップ（shared / web / desktop / mcp-server）をローカル実行し全緑（shared vitest = 300 files / 3022 tests）。実ブラウザ確認は §7.4 に従い merge 後 chat-main 側

#### 詰まり

`shared` の vitest が 1 回目だけ `[vitest-pool-runner]: Timeout waiting for worker to respond` で落ちた。テストの中身ではなくワーカー起動のタイムアウト（既知の偽シグナル）で、他のゲートが空いた静かな状態で単独実行したら 300 files / 3022 tests 全緑だった。

### 2026-09-06 - narrow 幅の Settings 2 件（#1525 / PR #1532・#1527 / PR #1534）

#### 概要

#1409（Mobile 幅 390×844 の実ブラウザ点検）が拾った settings レーンの open 2 件を、1 課題 = 1 ブランチ（どちらも origin/main 分岐）で直して PR まで出した。どちらも機能は正しく、狭い画面で「押しても何も起きないように見える」「名前が読めない」という見え方の問題。merge は P-001 でユーザー手番のため未実施。

#### 変更点

- **#1525 → PR #1532（カテゴリを選んでもドロワーが閉じない）**: narrow ではカテゴリ一覧が `MobileDrawer`（`role=dialog`・幅 332px = viewport の 85%）に載るので、`tab` を切り替えても切替先のペインは右端 58px しか見えなかった。`SettingsScreen.tsx` の `onSelect` で `!isWide` のときだけ `rightSidebar.close()` を呼ぶ — `DailyView` の日付選択・`NotesView` のノート選択と同じ形。`requestClose` ではなく `close` を使うのは、これがプログラム側の後片付けであって「下書きを捨てていいか」を聞く場面ではないため（#753 の契約）
- **#1525 の例外**: Tips 行だけは閉じない。Tips はペインではなく modal で、modal はどのみちドロワーを覆う。閉じてしまうと modal を閉じた瞬間に「選んでいないペイン」へ落ちるので、一覧に戻れる方を採った
- **#1527 → PR #1534（ゴミ箱のタイトル列が 111px）**: 390px の行は 44px のチェックボックス + ラベル付き「復元」ボタン + 削除アイコンで幅を使い切り、341px の行のうちタイトルに 111px しか残っていなかった（6〜8 文字で省略）。同じルーチンから生成された 30 行が全部同じ見た目になり、「どれを復元しようとしているのか」というゴミ箱唯一の問いに答えられない。`TrashView.tsx` の narrow 行を 2 段にし、1 段目はタイトル（+ チェックボックス）が独占、2 段目に復元 / 削除を右寄せ。タイトル列は約 270px。wide は無変更
- **#1527 で捨てた案（測ってから捨てた）**: Issue が併記していた「復元をアイコン化」は稼げるのが約 46px で、タイトルは行幅の半分（170px）に届かない。しかもこの部品が冒頭コメントで宣言している danger asymmetry（復元 = ラベル付きの主動線 / 削除 = アイコンで一段静か）が崩れ、アイコン 2 つが並ぶだけになる。2 段化は代わりに行の高さ（約 52px → 約 92px）を払うが、ゴミ箱は眺める一覧ではなく取り消しに来る場所なので、そちらの通貨で払う方が正しいと判断した
- **テスト**: jsdom にレイアウトが無い（§7.1）ので px は測れず、その px を生む**構造**を固定した。`settingsTabs.test.tsx` に 4 本（narrow で閉じる / wide で閉じない / Trash カテゴリでも閉じる / Tips では閉じない）、`trashView.test.tsx` に 3 本（narrow ではタイトルの行にボタンが 0 個 / 復元と削除は行内に揃って残る / wide は 1 行のまま）。**どちらも修正を一時的に戻して該当テストが落ちることを実測**（false green ではない）
- **検証**: 2 ブランチそれぞれで CI `verify` の全ステップ（shared / web / desktop / mcp-server）と `docs-lint` をローカル全緑。実ブラウザ確認は §7.4 に従い merge 後 chat-main 側
- **環境**: #1525 側の初回 sweep で `web/tests/briefingEveningLazyMount.test.tsx` が 1 件落ちたが、単体再実行 7/7 緑・静かな状態での web 全件 114 files / 1079 tests 緑で、既知の CPU 競合フレーク（`cold-vite-cache-fails-lazy-mount-tests`）。`git push` はこの機の credential manager が非対話で固まるため、`gh auth token` を一時 helper に渡す既知の回避で通した

### 2026-08-30 - Settings 3 件（#1210 / PR #1307・#1293 / PR #1317・#1294 / PR #1323）

#### 概要

settings-refine レーンの open Issue 3 件を、1 課題 = 1 ブランチ（いずれも origin/main 分岐）で実装し PR まで出した。merge は P-001 でユーザー手番のため未実施。3 本とも CI `verify` の全ステップ + `docs-lint` をローカルで全緑にしてから push した。

#### 変更点

- **#1210 → PR #1307（AI 連携の可視化・段階 1）**: アプリの UI に Claude / MCP 連携の痕跡がゼロだった問題。$0 制約（アプリから API を呼ばない）と DDL なしのまま、既存データからの導出だけで 3 箇所に出した — Settings の「AI 連携」カード / ビルド時生成のツールカタログ / Briefing の帰属バッジ
- **#1210 カタログの生成経路**: `mcp-server/scripts/dump-tool-catalog.mjs`（`npm run catalog` = `build && node`）が registry を `shared/src/generated/mcpToolCatalog.json` へ吐く（初回 35 本 / 36 KB）。**shared から registry を直 import できない** — `tools/<domain>.ts` が handler を、handler が Supabase クライアントを引き込むためフロントのバンドルに混入する。**dist/ を読む**形にしたのは plain Node に TypeScript ローダが無いから。registry の import 自体は副作用ゼロ（`getSupabase()` が遅延）
- **#1210 鮮度の担保**: 生成は手動なのでカタログは drift しうる。`mcp-server/tests/toolCatalogFreshness.test.ts` が **件数ではなく name / description / inputSchema を全件突き合わせる** — 件数だけだと改名で緑になり、かつ数値の第 2 の正本を作ってしまう（数値の非複製原則）。`shared/src/generated/` は `resolveJsonModule` + `include: ["src", "src/**/*.json"]` で既に通り、tsconfig の追加設定は不要だった
- **#1210 で踏んだ罠**: **`getDataService()` は同期で throw する**（Supabase 資格情報が無い環境 = shape suites）。promise の `.catch` では捕まらず、最初の実装は Settings を描画する **7 ファイル 48 テスト**を巻き添えにした。async 本体の中で構築して reject に落とす形に直し、`web/tests/settingsAiCard.test.tsx` に回帰テストを置いた。i18n の件数キーは `{{count}}` を避けて `{{n}}`（i18next が `count` を複数形トリガとして解釈する）
- **#1293 → PR #1317（Trash を Settings 配下へ）**: `shared/src/sections.ts` から `trash` 行を落とすだけで `SectionId` / サイドバー順 / mobile 順 / コマンドパレットが追随し、`sectionDescriptors` は `Record<SectionId, …>` なので削除が型で強制された。i18n は `section.trash` → `settings.tabs.trash` に改名（存在しないセクションを説明していた `tour.launcher.summary.trash` も削除）。保存済み `last-section` が `"trash"` でも `resolveInitialSection()` が registry と突き合わせて Briefing に落とすので、アップグレード後の空セクション着地は起きない
- **#1293 で分かったこと**: `TrashScreen` は `useSyncDomains` を使うので **SyncProvider が要る**。実アプリでは `AppProviders` が木の上位に 1 度だけ mount しており、セクション本体はその内側で描画されるため問題なし（`descriptor.body()` は要素を作るだけで hooks は走らない）。単体で画面を render する `web/tests/settingsTabs.test.tsx` だけカウンタを stub した。見出しはカード内・リストはカード外に置いた（`TrashView` が自前で枠付きカードを描くため丸ごと包むと枠が二重になる）
- **#1294 → PR #1323（複数選択 + 一括削除）**: 行と見出しにチェックボックス、選択があるとバーが「N 件を選択中」＋ 戻す / 削除 / 解除 に変わる。**一括削除も 1 件削除と同じ確認ダイアログを通す**（文だけ差し替え）。「空にする」は選択不要だが `ghost` で右端 — 画面で一番破壊的なので「次に押すのはこれ」に見せない。選択は**現在の groups を通してから** host へ渡すので、復元やカスケードで消えた行の幽霊を削除しにいかない
- **#1294 の host 側**: DataService に bulk の verb が無く、削除は子へカスケードするため親子を同じ選択に入れたら順番でしか処理できない。既存の 2 つのカテゴリ switch を **1 件ずつ順に**回し、失敗は throw せず**数える**（続行 → 生存行はリストに残る → 「N 件を処理できませんでした」）。DataService に bulk API を足す案は Mapper / sync まで波及するので採らず、Issue の要件（DataService 境界経由）は host のオーケストレーションで満たした
- **#1294 の依存判定ミス**: Issue の前提 #1275 を着手時に実測して「PR 無し」と確認したが、**作業中の 22:30 JST に PR #1321 が立った**。触るファイル 3 本が丸ごと重なるため、PR 本文を訂正して merge 順（#1321 先）を明記した。**着手時の 1 回の実測を、作業が終わるまで有効な事実として扱ってはいけない**（`all-label-issue-collision` と同じ形の再発）
- **環境**: `scripts/docs-lint.sh` はこの Windows 機で 15〜20 分（474 本の .md × 1 本あたり 4 プロセス）。並走させると `web/tests/briefingEveningLazyMount.test.tsx` が CPU 競合で `waitFor` タイムアウトするので、docs-lint と vitest は同時に回さない

### 2026-08-30 - Settings の見た目の小傷 2 件（Issue #1243 / PR #1261・Issue #1253 / PR #1271）

#### 概要

chat-main が merge 後の実ブラウザ検証で拾った Settings の小傷 2 件を、1 Issue = 1 ブランチ（origin/main 分岐）で直した。どちらも機能は正常で、直したのは見え方だけ。merge は P-001 でユーザー手番のため未実施。

#### 変更点

- **#1243 → PR #1261**: ja だけカテゴリ行と本文見出しが同じ場所を別の名前で呼んでいた（行 = section registry の「予定」／見出し = `settings.schedule.heading` の「スケジュール」）。en は両方 "Schedule" で偶然一致していたので露出しなかった。`heading` / `description` に加えて **`hint` も揃えた** — Issue の Scope には無いが同じペイン内の連続した文で同じ対象を指しており、片方だけ直すと 1 行下に同じ食い違いが残るため。設定画面の外（朝刊 / 分析 / コマンドパレット等）の「スケジュール」は対象外
- **#1243 の再発防止**: `shared/tests/settingsSectionNaming.test.ts` 新規。section registry の各セクションについて `settings.<id>.heading` があれば `section.<id>` と同値であることを en / ja で検査する。今日ペインを持つのは schedule だけだが、briefing / materials / work / analytics がペインを持ったら自動で対象に入る。`i18nKeys.test.ts` はキーの一致しか見ないのでこの種の**値**のズレは素通りしていた
- **#1253 → PR #1271 (1) ラベル二重**: 見出し行が px 読み値と並べて名前を出し、その真下で `SettingsSegment` が同じ名前をもう一度出していた。`SettingsSegment` に `hideLabel` を足し、**可視コピーだけ**を落とす（radiogroup の `aria-label` は据え置き。`description` はホストのキャプションなので残す）
- **#1253 → PR #1271 (2) テーマカードの溢れ**: カード幅は 3 列グリッド × 画面幅で決まるのに文字はユーザー設定で伸びるため、390px / 22px で glyph + "System" がカードを超えていた（Issue 実測 scrollWidth 102 > clientWidth 83）。ラベル行に 3 段の逃げ道を入れた — `flex-wrap`（名前が glyph の下に 1 行取れる）/ `min-w-0`（その行が max-content 幅を抱えずカード幅まで縮む）/ `break-words`（それでも入らない 1 単語を折る）。既存の `min-w-0` 単独では単語自体が折れず効いていなかった
- **テスト**: `shared/tests/narrowFontSizePolish.test.tsx` 新規。**修正を一時的に戻すと 2 件とも落ちることを実測**（`expected [...] to have a length of 1 but got 2` / `expected 'min-w-0' to contain 'break-words'`）。溢れそのものは jsdom にレイアウトが無く測れないので「折返しが許可されているか」を固定した — 22px の実表示は §7.4 に従い merge 後 chat-main（390px / en・ja）へ送った
- **検証**: 2 ブランチそれぞれで CI `verify` 全ステップ + `docs-lint` をローカル全緑（15/15）。GitHub Actions も両 PR で両ジョブ pass
- **環境の罠**: #1243 の初回ローカル実行で `web — test` が `briefingEveningLazyMount` の 2 件で落ちたが、これは lazy import した tiptap の mount を `waitFor`（既定 1 秒）で待つテストがマシン混雑で間に合わなかったもの。同 run に vitest のワーカー起動タイムアウトも出ていた。`--maxWorkers=2` で 100 files / 937 tests 全緑・単体でも 7/7 緑・GitHub CI も緑で、変更は `shared/` の ja 文字列 3 本とテスト 1 本のみ（`web/` に差分ゼロ）なので環境起因と判断した。なお `scripts/docs-lint.sh` はこの Windows 機だと初回 20 分近くかかる（468 本の .md × 1 本あたり 4 プロセス起動）— ハングではない

