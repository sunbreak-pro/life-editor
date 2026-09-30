---
Status: Ready # Draft → Ready（ClaudeDesign 投入可）→ Generated（デザイン生成済み）
Created: 2026-09-30
Section: briefing
Owner-chat: briefing-refine
Branch: docs/briefing-claudedesign-brief-2035
Issue: "#2035"
---

# Design Brief: Briefing（朝刊 / 夕刊）

> この文書は、Claude Design（claude.ai/design）に今の Briefing 画面を正確に伝えるための依頼文です。
> §3「貼り付け用プロンプト」の枠の中身を、1 通のメッセージとしてそのまま貼ります。
> Claude Design はリポジトリを読めません。そのため枠の中に、画面の構成・全ブロック・データの決まり・色と文字の決まり・今の描画コードをすべて入れてあります。

- **作成日と元の Issue**: 2026-09-30 に #2035 のために作りました。
- **使い方**: §3 の枠（4 つのバッククォートで囲んだ範囲）の中身を、エディタで raw テキストのままコピーします。Claude Design の新しいプロジェクトに 1 通で貼ります。2026-09-30 に決まった新しい設計（目標と Todo のつなぎ方・朝刊と夕刊の変更・Connect の新しいタブ）も、枠の「10. 決まった方向」に入っています。
- **スクリーンショット**: 実画面の撮影はまだです。撮影はメインのチャット（リポジトリ直下の chat-main）が受け持ちます。worktree では開発サーバーとブラウザを起動しない決まりがあるためです。届いたら、貼り付けと同じメッセージに画像を添付してください。画像が無くても、枠の中の説明とコードだけで送れます。
- **共通前提ブロックとの関係**: ほかの brief が冒頭に埋め込む [`_COMMON-CONTEXT.md`](./_COMMON-CONTEXT.md)（v4.1）は、この brief には埋め込んでいません。v4.1 には今のコードと食い違う値（`text-tertiary` の色など）があるためです。枠の中のシェル・色・文字の記述は、2026-09-30 のコードから書き起こしました。

## 1. 作り直す方向（2026-09-30 の Q&A で決まった設計）

> この節は、こうだいさんとの 6 回の Q&A（2026-09-30）で決まった設計です。§3 の枠の「10. 決まった方向」も同じ内容です。見た目（色・余白・動き）は Claude Design に任せ、ここでは画面の役割と振る舞いだけを決めています。保存の仕組み（目標をどのテーブルに持つか）は、このあと書く計画書で決めます。

朝刊は 1 日を始める画面にします。今日の予定と、やる気の出る一言を見せます。夕刊はその日を記録する画面にします。

### 1.1 今の困りごと（こうだいさんの言葉・2026-09-28）

- 今日の宣言と、週・月・年の目標が、ただの入力欄になっています。書いても手応えが小さく、すぐに飽きて続きません。
- 夕刊には、毎日書きたくなる引きがありません。

### 1.2 目標と Todo のつなぎ方

- **数と期間**: 目標は年・月・週の 3 つの期間に、それぞれ 3 つまで持てます。
- **階段**: 目標どうしは年 → 月 → 週の順につなぎます。Todo はどの期間の目標にも直接つなげます。1 つの Todo を複数の目標につなぐこともできます。
- **達成は自動で決まります**: 週の目標は、つないだ Todo が全部終わると達成になります。月と年の目標は、つないだ下の目標と、直接つないだ Todo がすべて達成・完了すると達成になります。
- **達成は今の状態を映します**: 達成したあとに未完了の Todo をつないだり、Todo の完了を取り消したりすると、達成が外れます。上の階層の達成も一緒に外れます。
- **未接続**: Todo も下の目標も 1 つもつながっていない目標は、「未接続」という分類に入ります。未接続の目標だけは、手で達成にできます。
- **立てる時期**: 目標はいつでも立てて直せます。期間の変わり目の朝刊は「今週の目標を立てましょう」と促すだけです。
- **期間末**: 期間が終わっても達成していない目標は、次の期間の最初の朝刊で 1 つずつ「持ち越す / やめる / 達成にする」を聞きます。
- **つなぐ操作は 2 か所からできます**: 目標の側（朝刊・夕刊・Connect）から Todo を選ぶ操作と、Todo を作る・編集するときに目標を選ぶ操作です。
- **今の目標の文章**: 今の期間の文章は、新しい目標の 1 つ目として移します。移した直後は Todo が無いので未接続に入ります。過去の期間の文章は履歴として残します。

### 1.3 朝刊

- **今日の宣言はやめます**。今日の予定に並ぶ、目標につながった Todo が宣言の代わりになります。夕刊の「今朝の宣言」も一緒になくなります。
- **いちばん上に、前の晩の自分からの一言を大きく出します**。今の「今日のフォーカス」をこれに置き換えます。
- **目標は今週の 3 つを主役にします**。それぞれに進み具合（つないだ Todo の完了数と棒）を出します。今月と今年の目標は、その上に 1 行ずつ添えます。
- **今日のスケジュールの Todo の行に、つながった目標の印を出します**。
- **Claude の講評は残します**。書かれた日だけ出ます。

### 1.4 夕刊

- **今日進んだ目標を出します**。「企画書を通す 2/4 → 3/4」のように、今日の完了で進んだ分を見せます。達成した目標とできなかった目標のどちらも目立つ色にします。ただし、まぶしく感じない色合いにします。
- **明日やる Todo を目標から選び、明日の予定に置けます**。
- **その日の出来事を自動で時間順に並べます**。終えた Todo・作業した時間・予定を並べ、気になった行に一言を足せます。
- **最後に「明日の自分へ」の 1 行を書きます**。翌朝の朝刊のいちばん上に出ます。今の「明日のフォーカス」はこれにまとめます。
- **気分の★を付けると、その日の夕刊が発行済みになります**。「夕刊 第 N 号」と号数を出します。号数は発行した日の通し番号で、間が空いても減りません。連続した日数は別に添えます。
- **「Daily に移動」ボタンを置きます**。そこからその日の Daily を開けます。
- 入れなかった案は、その日のデータから作る問いかけと、日中のメモを夕刊に集める案です。

### 1.5 目標と Todo を管理する画面（Connect）

- **Connect の header タブを「タグ」と「目標と Todo」の 2 つにします**。今の Connect はタブの無いタグの画面なので、それが「タグ」タブになります。
- **「目標と Todo」タブ**は、年 → 月 → 週の目標の木の下に Todo がぶら下がる画面です。どの目標にもつながらない Todo は、最後にまとめて出します。未接続の目標も、同じ画面に分類として出します。
- **Schedule の右パネルの「今日の Todo」には、Todo の名前の簡単な編集と、実行する日付・時間帯を決める機能を残します**。Todo 全体の管理は Connect で行います。
- **スマホでも全部できます**。目標の作成・編集・木の組み替えまでスマホで行えます。Connect の入口は、スマホでは今と同じ「その他」の中です。

### 1.6 Claude（MCP）

- 目標を立てる・Todo を目標につなぐ・進み具合を読む MCP の道具を用意します。スマホの Claude アプリからも使えます。
- 講評では、目標の進み具合に触れられます（例:「今週の『企画書を通す』は残り 1 件です」）。

### 1.7 まだ決めていないこと

- 夕刊の「一日の締めくくり」の自由記述欄を夕刊に残すか、「Daily に移動」から Daily で書く形に寄せるか。
- Briefing の右パネルにある「今日の Todo」を残すか。Schedule 側に残すことだけは決まっています。
- 目標の保存先（新しいアイテムの種類を作るか）。これは計画書で決めます。

## 2. 根拠にしたコードと文書

枠の中の記述は、次のコードと文書を 2026-09-30 に読んで確かめました。行番号はこの日の `docs/briefing-claudedesign-brief-2035` ブランチ（main と同じ内容）のものです。

- **朝刊の描画**は `shared/src/components/briefing/BriefingView.tsx` です。題字は `:585`、持ち越しのブロックは `:851` から始まります。
- **夕刊の描画**は `shared/src/components/briefing/EveningView.tsx` です。「一日の締めくくり」の枠は `:328` で、ここが使う `bg-lumen-surface` は `tokens.css` に定義がありません。そのため地は透明になり、紙面の地がそのまま見えます。
- **紙面の組み立てと詳細パネル**は `web/src/briefing/BriefingScreen.tsx` です。「今日の Todo」のトレイは `:532`、「きのうまでの自分」は `:594` です。
- **夕刊が最初に開く時刻**は `shared/src/components/briefing/eveningSection.ts:259` の 17 時です。
- **持ち越しを古い順に 5 件まで出す決まり**は `web/src/briefing/hooks/useBriefingAggregation.ts:176` にあります。
- **Claude が紙面に書く口**は MCP の `write_briefing`（`mcp-server/src/tools/briefing.ts:47`）で、書けるのはフォーカスの 1 行と講評の段落だけです。
- **色の値**は `shared/src/styles/tokens.css` から、**文言**は `shared/src/i18n/locales/ja.json` と `en.json` の `briefing.*` から写しました。
- **serif を使う範囲**は [`D-20260802-settings-1`](../../../decisions/D-20260802-settings-1.md) の回答 A（題字 2 つとフォーカス行だけ serif に固定し、本文は Settings のフォントに従う）です。
- **スマホでできること**は [`mobile-scope.md`](../../requirements/mobile-scope.md) の #1〜#3 と #18〜#20 です。
- **全ブロックの棚卸し**は [2026-09-28 のレポート](../../reports/2026-09-28-briefing-concept.html)にあり、この brief はそれをコードで確かめ直して使いました。

## 3. 貼り付け用プロンプト

下の枠の中身を 1 通で貼ります。

````markdown
# 依頼: Life Editor の「Briefing（朝刊 / 夕刊）」画面を作り直す案をください

## 0. お願いしたいこと

Life Editor というアプリの Briefing 画面を作り直します。この画面には「朝刊」と「夕刊」の 2 枚の紙面があります。このメッセージには、今の画面の構成、全ブロック、データの決まり、色と文字の決まり、今の描画コードをすべて入れました。これを読んだうえで、次のものをデザインしてください。

1. 作り直した朝刊と夕刊を、Desktop（1440×900）と Mobile（390×844）で、light と dark の両方について出してください。2 紙面 × 2 幅 × 2 テーマで 8 枚です。
2. 紙面ごとに、Claude がまだ何も書いていない状態と、データが埋まった状態を出してください。読み込み中の見た目も、紙面ごとに 1 枚ほしいです。
3. 3〜5 に書いたのは今の画面で、作り直しの出発点です。作り直しの仕様は「10. 決まった方向」にあり、今の画面と食い違うところは 10 を優先してください。10 でやめると決めたブロック（今日の宣言・今朝の宣言・明日のフォーカス）以外は、どれも使える状態で残してください。並べ替え、まとめ直し、見せ方の変更は自由です。消したほうがよいブロックがあれば、画面からは消さずに「消す提案」として理由を添えてください。
4. 紙面のほかに、10 に書いた次の画面もデザインしてください。Connect の「目標と Todo」タブ、目標に Todo をつなぐ選択の画面（目標の側から選ぶ形と、Todo を編集するときに目標を選ぶ形の 2 つ）、期間が終わったときに未達の目標を 1 つずつ聞く画面です。
5. 目標の達成・未達・未接続の見せ分けを提案してください。達成とできなかった目標のどちらも目立たせたいのですが、まぶしく感じない色合いにしてください。

スクリーンショットはまだ添付していません。届きしだい別のメッセージで送ります。

## 1. プロダクトの前提

- Life Editor は、AI と会話しながら生活を設計・記録・運用する個人用のアプリです。作者本人のほかに 10〜20 人へ配る予定で、各人は自分だけのワークスペースを使います。
- Briefing は、アプリを開くと最初に出るホーム画面です。
- Claude（AI）は MCP という外部接続を通じて、紙面の一部に文章を書き込みます。ただし配布先の多くの人は Claude を繋いでいません。そのため Claude が書く欄は空の日が多く、空のままでも紙面として成り立つ必要があります。
- 画面は Web アプリ（React + Tailwind CSS v4）です。Desktop と Mobile は同じコードで、幅 768px を境に配置が切り替わります。Mobile の役割は「読むこと」と「その場でさっと書くこと」で、1 タップで済む更新（完了の印・気分の★）と短い入力（宣言・目標・フォーカス）もできます。
- 表示言語は日本語と英語を切り替えられます。このメッセージには日本語の文言を載せ、英語は必要なところだけ括弧で添えます。英語は日本語より短いので、日本語の長さでレイアウトを組んでください。

## 2. アプリの外枠（Briefing の外側）

### Desktop（幅 768px 以上）

- 左にサイドバーがあります。展開時の幅は `w-60`、折りたたむと `w-16` です。どちらも rem 基準で、既定の文字サイズ（ルート 18px）ではそれぞれ 270px と 72px になります。地色は `bg-subsidebar` です。
- サイドバーの本流は上から「朝刊 / 予定 / 素材 / つながり / 集中 / 分析」の 6 行です。アイコンは lucide の Sunrise / Clock / Library / Tags / Timer / BarChart3 です。最下部に、本流から離して「設定」（Settings アイコン）が 1 行あります。
- メイン領域の上に見出し行があります。Briefing ではここが「朝刊 / 夕刊」のタブになります。タブは下線型で、選択中は accent 色の 2px 下線と太字（`font-medium` + text-primary）、非選択は text-secondary で、hover すると hover 色の地が付きます。
- 見出し行の右端には、左から順にコマンドパレットの検索欄（⌘K）、元に戻す / やり直す、詳細パネルの開閉ボタン（lucide の PanelRight）が並びます。
- 詳細パネルは右端に押し込み式で開きます。メイン領域の上に重ねるのではなく、メイン領域が縮みます。既定の幅は 320px で、左端のハンドルで幅を変えられます。地色は `bg-subsidebar` で、左に border があり、上部に「詳細」の見出しと閉じるボタンがあります。
- 紙面はメイン領域の中央に 1 列で置かれ、最大幅は `max-w-2xl`（42rem。ルート 18px で 756px）です。

### Mobile（幅 768px 未満）

- 下部にタブバーがあり、「朝刊 / 予定 / 素材 / 集中」の 4 つと「その他」が並びます。「その他」はボトムシートを開き、「分析 / つながり / 設定」を出します。safe-area（ホームバーの余白）に対応しています。
- Briefing では紙面のいちばん上に 1 行の帯が出ます。帯の左端はハンバーガー（lucide の Menu。枠付きのボタン）で、押すと左から幅 320px の引き出しが開きます。引き出しの中身は Desktop の詳細パネルと同じで、背後に黒 30% の幕が出ます。帯の中央は「朝刊 | 夕刊」のセグメントコントロール（地は bg-secondary、選択中は bg-primary の地に影 sm）、右端は元に戻す / やり直すです。
- Desktop の見出し行（タブ）は Mobile では出ません。帯が同じ役目をします。

### 最初に開くタブ

最初に開くタブは時刻で決まります。17 時以降は夕刊です。設定の「1 日の始まり」（例えば 4 時）より前の深夜も、前の日の夜として夕刊を開きます。それ以外の時刻は朝刊です。タブを押せばいつでも切り替えられます。

## 3. 朝刊のブロック（上から画面に出る順）

どのブロックも、見出しは「段標」という共通の形です。見出しは text-xs・太字・字間 0.25em の text-secondary で、左に幅 7px・高さ 14px の朱色の縦棒が付きます。見出しの右端には、注記（琥珀色の小さな文字）か「+」ボタンのどちらか一方が付くことがあります。ブロック同士は 1px の横罫線（border）で区切り、上下の余白は 20px（`py-5`）です。

### 3.1 題字と日付

- **表示**: 中央ぞろえで「LIFE EDITOR 朝刊」（英語は LIFE EDITOR BRIEFING）と出します。serif・text-2xl・semibold・字間 0.3em です。その下に小さく日付「2026年9月30日水曜日」（text-xs・字間 0.2em・text-secondary）を出します。題字の下の罫線だけは、太さ 4px の二重線（border-strong 色）です。
- **書き手**: アプリが今日の日付から作ります。
- **操作**: ありません。
- **Mobile の違い**: 「LIFE EDITOR」と「朝刊」の間で 2 行に折り返します。語の途中では折り返しません。

### 3.2 今日のフォーカス

- **表示**: 見出し「今日のフォーカス」（段標ではなく、朱色・text-xs・太字・字間 0.3em で中央ぞろえ）の下に、今日いちばん進めたいことを serif の大きな文字（text-xl・semibold）で中央ぞろえに出します。複数行もあり得ます。上下の余白は 24px です。
- **書き手**: 前の晩にユーザーが夕刊の「明日のフォーカス」で書くか、Claude が朝に書きます。
- **操作**: 朝刊では読むだけです。
- **空のとき**: Sunrise アイコンと「今日のフォーカスはまだありません。前日の夕刊で書くと、ここに表示されます。」を text-sm・text-secondary で出します。
- **Mobile の違い**: ありません。

### 3.3 昨日へのひとこと（Claude の講評）

- **表示**: 見出し「昨日へのひとこと」の右端に、Sparkles アイコン付きの丸い枠の印「Claude ・ 朝刊セクションより」（琥珀色の枠と文字）を付けます。本文は、琥珀の薄い地（`briefing-kohaku-subtle`）に左 2px の琥珀線を引いた角丸 8px の箱で、段落を text-sm で並べます。
- **書き手**: Claude だけです。
- **操作**: ありません。
- **空のとき**: ブロックごと表示しません。Claude を繋いでいない人には、このブロックは一度も出ません。

### 3.4 今日の宣言

- **表示**: 見出し「今日の宣言」の右端に、保存状態「保存済み」か「未保存」を出します。何も書いていない日は保存状態を出しません。その下に入力欄があります。
- **入力欄の形**: 高さが中身に合わせて伸びる、枠なしのテキストエリアです。朱の薄い地（`briefing-shu-subtle`）に左 2px の朱線を引いた角丸 8px の面で、文字は text-base です。placeholder は「今日は何をやり遂げますか。一行から宣言できます…」です。改行で複数行を書けます。
- **書き手**: ユーザーです。入力が止まって 0.8 秒後に自動で保存します。
- **空のとき**: 空の入力欄を出します。
- **Mobile の違い**: ありません。Mobile でも入力できます。

### 3.5 これからの目標

- **表示**: 見出し「これからの目標」の中に、「今週」「今月」「今年」の 3 つの欄を 16px 間隔で縦に並べます。各欄の小見出し（text-xs・太字・字間 0.2em）の右端に、琥珀色で期間を出します。例えば「9/27 – 10/3」「9月」「2026年」です。週は日曜始まりです。
- **入力欄の形**: 宣言と同じ入力欄です。placeholder は「今週やり遂げることを一行から…」「今月やり遂げることを一行から…」「今年やり遂げることを一行から…」です。
- **書き手**: ユーザーです。入力が止まって 0.8 秒後に自動で保存します。
- **期間の変わり目**: 週・月・年が変わると欄は空に戻ります。前の期間に書いたものは、「目標」ノートに履歴として残ります。
- **空のとき**: 空の欄を 3 つ出します。
- **Mobile の違い**: ありません。Mobile でも入力できます。夕刊には出ません。

### 3.6 今日のスケジュール

- **表示**: 見出し「今日のスケジュール」の右端に「+」ボタン（読み上げ名は「今日のスケジュールに追加」）があります。行は「今日の Todo → 細い区切り線 → 終日の予定 → 時刻つきの予定」の順に並び、行の高さは 44px 以上です。
- **Todo の行**: 左から時刻の列（幅 3.5rem。時刻があれば「09:30」を朱の太字で出し、無ければ空けます）、丸いチェック（lucide の Circle、完了で CheckCircle2 に変わり朱色になる）、タイトル（完了すると取り消し線と text-secondary）、右端に「編集」（ArrowUpRight）と「削除」（Trash2）の文字付きボタンです。Todo にノートをつないであれば、タイトルの下に琥珀の太字で「◈ 秋の新規案件 ・ 読書メモ」のようにノート名を出します。
- **予定の行**: 時刻の列（「終日」か「10:00」）、タイトル、ルーチンから作られた予定なら「ルーチン」の丸いタグ（琥珀の枠と薄い地）、右端に編集と削除です。予定には完了の印がありません。
- **操作**: Todo のチェックかタイトルを押すと、完了と未着手が切り替わります。「編集」はその Todo や予定を予定画面で開きます。「削除」はすぐ消して、「元に戻す」で戻せる通知を出します。ルーチンから作られた予定を消すときは、「この予定のみ / この予定と今後の予定 / すべての予定（過去分も含む）」を選ぶダイアログを先に出します。「+」は作成パネルをダイアログで開きます。作成パネルでは予定か Todo かを選んで作れて、既存の Todo を今日に置くことや、ノートを添えることもできます。
- **空のとき**: Todo も予定も無い日は「今日のスケジュールはありません」を出します。
- **Mobile の違い**: 編集と削除は文字が消えてアイコンだけになり、タイトルの下の段に右寄せで回ります。タイトルの幅を確保するためです。どのボタンも押せる面は 44px 四方以上です。

### 3.7 持ち越し

- **表示**: 見出し「持ち越し」の下に、過去の日に置いたまま終わっていない Todo を、古い順に最大 5 件出します。左の列に「3日目」「12日目」（朱の太字）、丸いチェック、タイトル、右端に「編集」だけを並べます。持ち越しに削除はありません。今日完了にしたものは、取り消し線付きで残ります。
- **書き手**: アプリが Todo の一覧から選びます。完了の印はユーザーが付けます。
- **空のとき**: ブロックごと表示しません。

## 4. 夕刊のブロック（上から画面に出る順）

### 4.1 題字と日付

朝刊と同じ形で「LIFE EDITOR 夕刊」（英語は LIFE EDITOR EVENING）と日付を出します。

### 4.2 今日の気分

- **表示**: 見出し「今日の気分」（朱色・中央ぞろえ）の下に、lucide の Star を 26px で 5 つ横に並べます。選んだ数までを朱で塗り、残りは text-secondary の線だけです。hover すると★が 1.1 倍になります。
- **操作**: ★を押すとその数を選びます。同じ★をもう一度押すと解除します。読み上げ名は「気分 1/5」〜「気分 5/5」です。
- **空のとき**: 塗りの無い★を 5 つ出します。
- **Mobile の違い**: 各★の押せる面が 44px 四方に広がります。

### 4.3 今朝の宣言

- **Desktop**: 見出し「今朝の宣言」の下に、朝に書いた宣言を読み返しとして出します。琥珀の薄い地に左 2px の琥珀線を引いた箱で、編集はできません。宣言が無い日はブロックごと出しません。
- **Mobile**: 入力欄になり、見出しは「今日の宣言」に変わります。placeholder は「今日の宣言。一行から書けます…」で、保存状態も出します。スマホで夕刊を開いた人が、朝刊へ戻らずに宣言を書けるようにするためです。

### 4.4 一日の締めくくり

- **表示**: 見出し「一日の締めくくり」の右端に保存状態を出します。何も書いていない日は出しません。その下に border 付き・角丸 8px の枠があり、中に振り返りの本文を出します。枠の地は紙面と同じです。
- **操作**: ふだんは本文を文字として出し、枠を押すとリッチテキストの編集欄に切り替わります。切り替えで高さが変わらないよう、枠は約 244px の高さを保ちます。枠の読み上げ名は「今日のふり返りを書く」です。
- **書き手**: ユーザーです。入力が止まって 0.8 秒後に自動で保存します。
- **空のとき**: 「今日はどんな一日でしたか…」を text-secondary で出します。

### 4.5 明日のフォーカス

- **表示**: 見出し「明日のフォーカス」の下に、宣言と同じ入力欄を出します。placeholder は「明日いちばん進めたいことを一行で…」です。
- **つながり**: ここに書いた内容が、翌朝の朝刊の「今日のフォーカス」に出ます。
- **Mobile の違い**: ありません。Mobile でも入力できます。

### 4.6 残りの Todo

- **表示**: 見出し「残りの Todo」の下に、今日の Todo と持ち越し（最大 5 件）を並べます。今日完了にしたものは、取り消し線付きで残ります。持ち越しの行には、右に「3日目」を朱の太字で出します。各行は丸いチェックとタイトルだけで、行の間は点線です。編集と削除のボタンはありません。
- **操作**: チェックを押すと完了と未着手が切り替わります。
- **空のとき**: 「残っている Todo はありません」を出します。

### 4.7 今後の予定

- **表示**: 見出し「今後の予定」の下に、今日の予定のうち今の時刻以降のもの（終日の予定を含む）と、明日の予定すべてを並べます。各行は時刻の列（朱の太字）とタイトルで、明日の予定には「明日」の丸いタグ（琥珀）を付けます。
- **操作**: ありません。読むだけです。
- **空のとき**: 「この先の予定はありません」を出します。

## 5. 詳細パネル（Desktop の右パネルと Mobile の引き出し）

### 5.1 今日の Todo（朝刊と夕刊の両方）

- 見出し「今日の Todo」（text-sm・semibold）の右端に、朝刊のときだけ「+」があります。紙面の「+」と同じ作成パネルを開きます。
- 1 つ目のグループは「予定済み」で、今日に置いた Todo を並べます。時刻の無い Todo には「終日」の小さなチップ（chip-task の青）を、時刻のある Todo には右に時刻を出します。各行の左に丸いチェックがあります。空のときは「今日の Todo はまだありません」を出します。
- 2 つ目のグループは「Todo 一覧」で、まだどの日にも置いていない Todo を並べます。各行の右端に、枠付きの「+」（読み上げ名は「今日の予定に追加」）があります。空のときは「未配置の Todo はありません」を出します。
- 行の間は 1px の border で区切ります。

### 5.2 きのうまでの自分（朝刊だけ）

- 上に 1px の区切り線を引き、見出し「きのうまでの自分」の下に 3 つのカードを縦に並べます。
- 「ストリーク」は、作業の連続日数を「現在」と「最長」で出します。記録が無いときは「作業を開始してストリークを積み上げよう！」を出します。
- 「Todo 完了トレンド」は、直近 7 日の完了数の面グラフです。
- 「作業・休憩バランス」は、直近 7 日の作業・休憩・長い休憩の棒グラフです。

## 6. 状態

- **読み込み中**: 紙面の位置に、高さ 44px のスケルトン行を 12px 間隔で 8 本出します。Mobile では、上の帯（朝刊 / 夕刊の切替）は読み込み中も出したままにします。
- **保存に失敗したとき**: 通知（トースト）で「今日の宣言を保存できませんでした。書いた内容は画面に残っていますが、まだ保存されていません。通信を確認して、もう一度書き直してください。」を出します。夕刊・目標・明日のフォーカスにも、同じ形の文があります。
- **行を削除したとき**: 通知で「「企画書の初稿を仕上げる」を削除しました。ヘッダーの「元に戻す」で戻せます。」を出します。
- **Claude を繋いでいない人**: 「昨日へのひとこと」が出ません。「今日のフォーカス」は、前の晩に自分で書いていなければ空の文になります。ほかのブロックはアプリとユーザーの入力で埋まります。

## 7. データの決まり（デザインを縛るもの）

- 朝刊の講評、宣言、夕刊（気分と振り返り）は、1 日 1 枚の「デイリー」という文書の中で、見出し「朝刊」「宣言」「夕刊」で分けた節として保存します。デイリーは「素材 > デイリー」でも開けて、そこで直接書き換えることもできます。
- 気分は、夕刊の節の 1 行目に「気分: 4/5」という文字で入ります。
- フォーカスと目標は、予約済みのノート 2 枚（「フォーカス」と「目標」）に入ります。フォーカスは日付ごと、目標は期間ごとの節です。過去の分は消さずに履歴として残ります。
- Claude が紙面のために書けるのは、フォーカスの 1 行と、講評の段落の 2 つだけです。夕刊には Claude が書く欄がありません。
- 完了の印は、Todo そのものの完了フラグを書き換えます。紙面が別に状態を持つことはありません。Todo の状態は「未着手」と「完了」の 2 つです。予定（イベント）には、画面上の完了がありません。
- Briefing 専用のデータベースの表はありません。新しい保存先が要る案（例えば宣言への ○ / △ / × や号数）は、「新しい保存先が要る」と明記してください。
- 1 日の境目は、設定の「1 日の始まり」の時刻です。

## 8. ビジュアルシステム

### 8.1 色（トークン）

色はすべてトークンで指定し、値を直接書きません。Tailwind のクラス名は `bg-lumen-bg` や `text-lumen-briefing-shu` の形です。light は「生成りの紙に燈色（ひいろ）」、dark は「藍の夜空に薄藍」という配色で、ほぼ無彩色の地にアクセントを 1 本通しています。

| 役割                                 | Tailwind 名（`bg-` / `text-` / `border-` の後ろ） | Light（朝刊）                     | Dark（夕刊）                      |
| ------------------------------------ | ------------------------------------------------- | --------------------------------- | --------------------------------- |
| アプリの地色（bg-primary）           | `lumen-bg`                                        | `#fbf4e8`                         | `#101a2c`                         |
| 一段沈んだ地（bg-secondary）         | `lumen-bg-secondary`                              | `#f5ebda`                         | `#18243c`                         |
| サイドバーと詳細パネルの地           | `lumen-bg-subsidebar`                             | `#f8efe1`                         | `#18243c`                         |
| くぼんだ面（検索欄など）             | `lumen-surface-sunken`                            | `#efe3cd`                         | `#0a1220`                         |
| 本文の文字                           | `lumen-text`                                      | `#2b2015`                         | `#edf1f9`                         |
| 補助の文字                           | `lumen-text-secondary`                            | `#6b5a45`                         | `#a4b2ca`                         |
| 三段目の文字（件数・日時）           | `lumen-text-tertiary`                             | `#756249`                         | `#8e9aaf`                         |
| 罫線                                 | `lumen-border`                                    | `#eadec6`                         | `#263650`                         |
| 強い罫線                             | `lumen-border-strong`                             | `#d6c3a2`                         | `#3c4e70`                         |
| アクセント（主ボタン・選択・リンク） | `lumen-accent`                                    | `#ad4409`                         | `#85aaff`                         |
| アクセントの hover                   | `lumen-accent-hover`                              | `#8f3807`                         | `#a3c0ff`                         |
| アクセントの上の文字                 | `lumen-on-accent`                                 | `#ffffff`                         | `#0a1024`                         |
| アクセントの薄塗り                   | `lumen-accent-subtle`                             | `#fbe3c6`                         | `#1e2d4b`                         |
| 行の hover                           | `lumen-hover`                                     | `#f0e5d0`                         | `#22314e`                         |
| 紙面の朱（ユーザーの操作・今日の印） | `lumen-briefing-shu`                              | `#ad2f1d`                         | `#f0907c`                         |
| 朱の薄塗り（入力欄の地）             | `lumen-briefing-shu-subtle`                       | `#f7e0d6`                         | `#35201f`                         |
| 紙面の琥珀（注記・Claude・文脈）     | `lumen-briefing-kohaku`                           | `#8a5c06`                         | `#dcb267`                         |
| 琥珀の薄塗り（講評・読み返しの地）   | `lumen-briefing-kohaku-subtle`                    | `#f6e7c8`                         | `#2e2513`                         |
| ミントの差し色                       | `lumen-accent-secondary`                          | `#1fa56e`                         | `#5fd1a0`                         |
| ミントのチップ（地 / 文字）          | `lumen-chip-mint-bg` / `-fg`                      | `#daf3e7` / `#0c6f4e`             | `#133024` / `#7fe0b3`             |
| 成功 / その薄塗り                    | `lumen-success` / `-subtle`                       | `#0f7b6c` / `#e7e4d3`             | `#4dab9a` / `#1c2f44`             |
| 危険 / その薄塗り                    | `lumen-danger` / `-subtle`                        | `#d92d20` / `#f0e5e6`             | `#ef4444` / `#2f2126`             |
| 情報 / その薄塗り                    | `lumen-info` / `-subtle`                          | `#2563eb` / `#e9e3db`             | `#60a5fa` / `#1e2e4b`             |
| 注意 / その薄塗り                    | `lumen-warning` / `-subtle`                       | `#b45309` / `#f1e2cd`             | `#fbbf24` / `#2a303a`             |
| Todo のチップ（地 / 文字 / 点）      | `lumen-chip-task-bg` / `-fg` / `-dot`             | `#dbeafe` / `#1e40af` / `#1d4ed8` | `#1d2348` / `#aebcff` / `#5b8cff` |

- **朱と琥珀の使い分け**: 朱は、ユーザー自身が付ける印と今日の印に使います。段標の縦棒、時刻、チェック（完了時）、★、宣言と目標とフォーカスの入力欄、持ち越しの日数がそうです。琥珀は注記と文脈に使います。Claude の講評、講評の印、Todo につないだノート名、ルーチンと明日のタグ、目標の期間、保存状態、夕刊での宣言の読み返しがそうです。
- **グラフの色**（詳細パネルのグラフだけで使い、テーマで変わりません）: `#2563eb` `#22c55e` `#f59e0b` `#ef4444` `#8b5cf6` `#ec4899` `#06b6d4` `#84cc16` `#f97316` `#6366f1`。完了を示す帯は `#10b981` です。
- **影**: elevation を sm / md / lg の 3 段で持ちます。紙面ではほとんど使わず、セグメントコントロールの選択中に sm を使う程度です。

### 8.2 文字

- 本文は、設定で選んだフォントに従います。既定はシステムの sans-serif（`ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, …`）です。
- serif（`ui-serif, Georgia, Cambria, "Times New Roman", Times, serif`）は、朝刊と夕刊の題字、朝刊のフォーカス行の 3 か所だけに固定で使います。新聞らしさを設定に左右されずに保つための、ユーザーの決定です。本文や講評は serif に固定しません。
- 文字の大きさは、設定でアプリ全体を 12〜25px の段階で拡縮できます。既定はルート 18px です。サイズはすべて rem で組み、固定の px を前提にしないでください。`text-xs` は 0.8125rem に引き上げてあります。
- 紙面の見出しは、字間を広げた小さな太字（段標）です。題字は字間 0.3em、日付は字間 0.2em です。

### 8.3 形と余白

- 角丸は 6px / 8px / 12px と完全円（9999px）です。紙面の箱（入力欄・講評・振り返りの枠）は 8px です。
- 余白は 4px を単位にします。ブロックの上下は 20px、フォーカスと気分のブロックは 24px です。
- 紙面は罫線で区切る作りです。ブロックの間は 1px の横罫線で、題字の下だけ 4px の二重線です。カードを敷き詰めたダッシュボードの形は、今は意図して避けています。
- 画面の端の余白は、狭い画面で 16px、広い画面で 24px です。

### 8.4 アイコン

アイコンは lucide-react だけを使います。今の紙面とパネルで使っているのは Sunrise、Sparkles、Plus、ArrowUpRight、Trash2、Star、Circle、CheckCircle2、CalendarMinus、Menu、PanelRight です。アイコンは最小 0.9rem まで自動で引き上げます。

### 8.5 動き

- 初めて開いたセクションは、0.3 秒かけて 8px 持ち上がりながらフェードで出ます。
- 詳細パネルは右から 0.2 秒で、Mobile の引き出しは左から 0.22 秒で入ります。背後の幕は 0.2 秒でフェードします。
- 気分の★は hover で 1.1 倍になります。
- 設定の「動きを減らす」（OS に従う / 常に減らす / 常に動かす）で、アニメーションとトランジションをすべて止められます。

### 8.6 使いやすさの決まり

- Mobile では、押せるものはすべて 44×44px 以上の面を持ちます。見た目の箱が小さくても、実際に押せる面が 44px に届く必要があります。
- 主要な面（カード・メニュー・ダイアログ・パネル・ポップオーバー）の地は完全に不透明にします。半透明と backdrop-blur は使いません。許されるのは、モーダルの背後に出す黒 30% の幕だけです。
- キーボード操作では、`focus-visible` で accent 色の 2px のリングを出します。
- 本文の文字は、地に対して WCAG AA（4.5:1）以上のコントラストにします。
- 状態を色だけで伝えません。取り消し線・アイコンの形・文字を併用します。
- 同じ名前のボタンが並ばないよう、行のボタンの読み上げ名にはその行のタイトルか行き先を含めます（例: 「編集: スケジュールで開く」）。
- 日本語入力（IME）で変換を確定する Enter が、送信や改行として誤作動しない入力にします。Mobile の入力欄の文字は 16px 以上にします（iOS が画面を拡大してしまうためです）。

## 9. 守ること・やらないこと

- 色は 8.1 の表のトークンだけを使ってください。新しい色が要るときは、「トークン追加の提案」として値と用途を書いてください。
- 紫のグラデーションは使わないでください。
- 弾む・きらめく・紙吹雪のような、動きすぎるマイクロインタラクションは入れないでください。
- Desktop と Mobile の両方、light と dark の両方を必ず作ってください。dark の地は純粋な黒ではなく `#101a2c`、light の地は純粋な白ではなく `#fbf4e8` です。
- Claude が一度も書いていない状態でも、紙面として成り立つようにしてください。Claude の欄が空の日を「壊れた画面」に見せないでください。
- 文言は日本語の現実的な例で組んでください。「タスク A」のような仮の文字は使わないでください。

## 10. 決まった方向（作り直しの仕様）

作者と相談して決めた仕様です。画面の役割と振る舞いは決まっています。見た目（色・余白・動き・部品の形）はおまかせします。

**朝と夜の役割**: 朝刊は 1 日を始める画面です。今日の予定と、やる気の出る一言を見せます。夕刊はその日を記録する画面です。

**作り直す理由（作者の言葉）**

- 今日の宣言と、週・月・年の目標が、ただの入力欄になっています。書いても手応えが小さく、すぐに飽きて続きません。
- 夕刊には、毎日書きたくなる引きがありません。

### 10.1 目標と Todo のつなぎ方

- 目標は年・月・週の 3 つの期間に、それぞれ 3 つまで持てます。
- 目標どうしは年 → 月 → 週の順につなぎます。Todo はどの期間の目標にも直接つなげます。1 つの Todo を複数の目標につなぐこともできます。
- 達成は自動で決まります。週の目標は、つないだ Todo が全部終わると達成です。月と年の目標は、つないだ下の目標と、直接つないだ Todo がすべて達成・完了すると達成です。
- 達成は今の状態を映します。達成したあとに未完了の Todo をつないだり、Todo の完了を取り消したりすると、達成が外れます。上の階層の達成も一緒に外れます。
- Todo も下の目標も 1 つもつながっていない目標は「未接続」という分類に入ります。未接続の目標だけは手で達成にできます。
- 目標はいつでも立てて直せます。期間の変わり目の朝刊は「今週の目標を立てましょう」と促すだけです。
- 期間が終わっても達成していない目標は、次の期間の最初の朝刊で 1 つずつ「持ち越す / やめる / 達成にする」を聞きます。
- つなぐ操作は 2 か所からできます。目標の側（朝刊・夕刊・Connect）から Todo を選ぶ操作と、Todo を作る・編集するときに目標を選ぶ操作です。

### 10.2 朝刊

- 今日の宣言の欄はやめます。今日の予定に並ぶ、目標につながった Todo が宣言の代わりになります。
- いちばん上に、前の晩の自分からの一言（「明日の自分へ」で書いたもの）を大きく出します。今の「今日のフォーカス」をこれに置き換えます。
- 目標は今週の 3 つを主役にし、それぞれに進み具合（つないだ Todo の完了数と棒）を出します。今月と今年の目標は、その上に 1 行ずつ添えます。
- 今日のスケジュールの Todo の行に、つながった目標の印を出します。
- Claude の講評は残します。書かれた日だけ出ます。

### 10.3 夕刊

- 今日進んだ目標を出します。「企画書を通す 2/4 → 3/4」のように、今日の完了で進んだ分を見せます。達成した目標と、できなかった目標のどちらも目立つ色にします。ただし、まぶしく感じない色合いにします。
- 明日やる Todo を目標から選び、明日の予定に置けます。
- その日の出来事を自動で時間順に並べます。終えた Todo・作業した時間・予定を並べ、気になった行に一言を足せます。
- 最後に「明日の自分へ」の 1 行を書きます。翌朝の朝刊のいちばん上に出ます。今の「明日のフォーカス」はこれにまとめます。
- 気分の★を付けると、その日の夕刊が発行済みになります。「夕刊 第 N 号」と号数を出します。号数は発行した日の通し番号で、間が空いても減りません。連続した日数は別に添えます。
- 「Daily に移動」ボタンを置き、そこからその日の Daily（日記のページ）を開けるようにします。
- 「今朝の宣言」のブロックはなくなります。

### 10.4 目標と Todo を管理する画面（Connect）

- Connect はアプリのサイドバーにある、タグを入口に記録を読むセクションです。今はタブが無く、タグの画面だけがあります。
- Connect の header タブを「タグ」と「目標と Todo」の 2 つにします。今のタグの画面が「タグ」タブになります。
- 「目標と Todo」タブは、年 → 月 → 週の目標の木の下に Todo がぶら下がる画面です。どの目標にもつながらない Todo は、最後にまとめて出します。未接続の目標も、同じ画面に分類として出します。
- Schedule（予定を組むセクション）の右パネルには、Todo の名前の簡単な編集と、実行する日付・時間帯を決める機能を残します。Todo 全体の管理は Connect で行います。
- スマホでも、目標の作成・編集・木の組み替えまで全部できます。Connect の入口は、スマホでは下部タブバーの「その他」の中です。

### 10.5 Claude の役割

- Claude は MCP の道具で、目標を立てる・Todo を目標につなぐ・進み具合を読むことができます。
- 朝刊の講評では、目標の進み具合に触れます（例:「今週の『企画書を通す』は残り 1 件です」）。
- Claude を繋いでいない人でも、目標・進み具合・夕刊はすべて自分の操作で埋まります。Claude の講評が無い日を、欠けた画面に見せないでください。

### 10.6 まだ決めていないこと（どちらの案でも組めるようにしてください）

- 夕刊の「一日の締めくくり」の自由記述欄を夕刊に残すか、「Daily に移動」から Daily で書く形に寄せるか。
- Briefing の右パネルにある「今日の Todo」を残すか。

## 11. サンプルデータ（2026年9月30日水曜日）

10 の新しい仕様に合わせた例です。

### 目標（2026年9月30日時点）

- 今年（2026年）: 「10 km を 60 分以内で走る」（下の目標 1 つ・まだ未達）、「英語で発信できるようになる」（未接続）
- 今月（9月）: 「秋の新規案件を受注する」（今年のどれにもつながっていない・下の目標 1 つ）、「週 3 回走る習慣をつける」（今年「10 km を 60 分以内で走る」の下）
- 今週（9/27 – 10/3）:
  - 「企画書を通す」（今月「秋の新規案件を受注する」の下・つないだ Todo 4 件のうち 2 件完了）
  - 「3 回走る」（今月「週 3 回走る習慣をつける」の下・3 件のうち 1 件完了）
  - 「本を 1 冊読み切る」（未接続・Todo なし）
- 先週から未達で残った目標（期間末に聞く画面の例）: 「部屋の模様替えを決める」（つないだ Todo 2 件のうち 1 件完了）

### 朝刊（データが埋まった状態）

- いちばん上の「前の晩の自分から」: 「企画書は午前で出し切る。昼休みに区役所へ。」
- 昨日へのひとこと（Claude）: 「今週の『企画書を通す』は残り 2 件です。初稿を午前に送れば、明日の見積もりに回せます。」「午後は歯科検診で抜けるので、集中が要る作業は午前に寄せるのがよさそうです。」
- 今年・今月の目標を 1 行ずつ、今週の 3 つを進み具合つきで表示します（上の「目標」のとおり）。
- 今日のスケジュール:
  - Todo「09:30 企画書の初稿を仕上げる」（目標の印: 企画書を通す）
  - Todo「12:10 住民票を取りに行く」（目標の印なし）
  - Todo「19:00 5 km ジョグ」（目標の印: 3 回走る）
  - Todo「経費精算を出す」（時刻なし・完了済み）
  - 予定「終日 燃えるゴミの日」
  - 予定「07:00 朝のストレッチ」（ルーチン）
  - 予定「10:00 チーム定例」（ルーチン）
  - 予定「14:00 歯科検診」
- 持ち越し: 「12日目 本棚を整理する」

### 夕刊（データが埋まった状態）

- 題字の横: 「夕刊 第 42 号」「5 日連続」
- 今日の気分: ★ 4 つ（付けた時点で発行済み）
- 今日進んだ目標: 「企画書を通す 2/4 → 3/4」、「3 回走る 1/3 → 2/3」。達成の見せ方の例として、別の日に「3 回走る」が 3/3 で達成になった状態も 1 枚ほしいです。
- 今日の出来事（自動の並び）: 「09:30–11:20 作業 企画書」「11:28 完了 企画書の初稿を仕上げる」「14:00 歯科検診」「19:00 完了 5 km ジョグ」。「企画書の初稿を仕上げる」の行に一言「定例で方向性が固まった」が付いています。
- 明日の予定に置く Todo: 「企画書を通す」から「見積もりのたたき台を作る」を選んで、明日の 09:00 に置いた状態です。
- 残りの Todo: 「住民票を取りに行く」（未完了）、「12日目 本棚を整理する」
- 今後の予定: 「21:00 ストレッチと日記」（ルーチン）、明日「終日 資源ゴミの日」、明日「09:00 見積もり打ち合わせ」
- 明日の自分へ: 「見積もりは 10 時までに叩き台を出す」
- 「Daily に移動」ボタン

### Connect の「目標と Todo」タブ

- 上の「目標」を年 → 月 → 週の木にして、各目標の下につないだ Todo を並べます。
- どの目標にもつながらない Todo: 「住民票を取りに行く」「本棚を整理する」「経費精算を出す」（完了）
- 未接続の目標: 「英語で発信できるようになる」（今年）、「本を 1 冊読み切る」（今週）

### 空の状態（Claude なし・入力なし）

- 朝刊: 前の晩の一言は「まだありません。夕刊の『明日の自分へ』で書くと、ここに出ます」の案内、講評のブロックは出ない、目標は「今週の目標を立てましょう」の案内、スケジュールは「今日のスケジュールはありません」、持ち越しは出ない。
- 夕刊: 未発行（★は塗りなし・号数は前回のまま）、今日進んだ目標は「今日進んだ目標はありません」、出来事の並びは空の案内、明日の自分へは空の入力欄、「残っている Todo はありません」「この先の予定はありません」。
- Connect の「目標と Todo」タブ: 目標が 1 つも無い状態の案内。

## 12. 出してほしいもの

- 朝刊と夕刊それぞれについて、Desktop 1440×900（サイドバー展開・詳細パネルを開いた状態）と Mobile 390×844（下部タブバー込み）を、light と dark で作ってください。
- 各紙面に「データあり」「空（Claude なし）」「読み込み中」の 3 状態を用意してください。
- Connect の「目標と Todo」タブを、Desktop と Mobile、light と dark で作ってください。「データあり」と「目標が無い」の 2 状態がほしいです。
- 目標に Todo をつなぐ選択の画面を、目標の側から選ぶ形と、Todo を編集するときに目標を選ぶ形の 2 つ作ってください。スマホでの見え方も入れてください。
- 期間が終わったときに未達の目標を 1 つずつ聞く画面（持ち越す / やめる / 達成にする）を作ってください。
- 目標の達成・未達・未接続の見せ分けを、light と dark の両方で見比べられる形で出してください。
- Mobile で詳細パネルの引き出しを開いた状態を 1 枚ほしいです。
- 変えた点と、その理由の一覧を添えてください。新しいトークンや新しい保存先が要る案は、その旨を明記してください。

## 付録: 今の描画コード

以下は今の描画コードです。ファイル名を見出しにしています。朝刊の `BriefingView.tsx` と夕刊の `EveningView.tsx` は、コメントも含めてそのまま写しました。コメントには、各部分をなぜその形にしたかが書いてあります。ほかのファイルは、長さを抑えるためにコメントと空行を除いた形で載せています。`BriefingScreen.tsx` は紙面と詳細パネルを組み立てる 517〜755 行目だけ、`tokens.css` は色・トークン名・最小サイズ・動きの部分だけを抜き出しました。テストとデータ取得のフックは入れていません。

### shared/src/components/briefing/BriefingView.tsx（朝刊の紙面・全文）

```tsx
import type { ReactNode } from "react";
import { ArrowUpRight, Plus, Sparkles, Sunrise, Trash2 } from "lucide-react";
import type { TodoNode, TodoStatus } from "../../types/todoTree";
import type { TimerSession } from "../../types/timer";
import { SkeletonList } from "../SkeletonList";
import { TAP_TARGET_TALL } from "../styleTokens";
import { TodoStatusCheckbox } from "../TodoStatusCheckbox";
import type { ExtractedBriefing } from "./extractBriefing";
import { IntentionField } from "./IntentionField";
import { BRIEFING_HINT_CLASS } from "./briefingStyles";
import { GoalsBlock, type GoalsBlockLabels } from "./GoalsBlock";
import type { GoalPeriod } from "./goalSections";

/*
 * BriefingView — the morning-paper home surface (Briefing plan Step 1).
 *
 * Pure presentation (§6.4): no DataService, no useTranslation — the host
 * (web/src/briefing/BriefingScreen.tsx) fetches + aggregates and injects
 * everything through props. Layout language is "紙面, not dashboard":
 * a single centered reading column, generous rules (borders), serif display
 * type for the masthead/focus line, and the Briefing accent duo (#269):
 * 朱 lumen-briefing-shu for "today / action" marks, 琥珀 lumen-briefing-kohaku
 * for context / annotations. All colors are lumen-* tokens (no hardcodes).
 *
 * The visual zone —「きのうまでの自分」, the three adopted Analytics widgets —
 * used to be one of these sections. It lives in the shared detail panel now
 * (#938 → BriefingVizPanel.tsx): everything the paper prints is about today,
 * and three backward-looking charts in the middle of it kept breaking that
 * thread while pushing 持ち越し below the fold. The host still computes the
 * data from the same BriefingData it passes here.
 */

/** One row of「今日のスケジュール」— today's schedule, host-shaped. */
export interface BriefingScheduleEntry {
  id: string;
  title: string;
  /** "HH:MM" (empty for all-day). */
  startTime: string;
  /**
   * Data only since #1373 — nothing on the paper draws it. An event has no
   * completion in the UI any more, but the `completed` column and the MCP
   * `set_schedule_complete` tool both stay, and 夕刊's「今後の予定」still
   * drops a row that tool has closed.
   */
  completed: boolean;
  /** True when the item was generated from a Routine (shows the tag). */
  isRoutine: boolean;
  isAllDay: boolean;
}

/**
 * One todo row of「今日のスケジュール」— host-shaped, purposes resolved to
 * titles. Since #939 these ride inside the schedule block rather than under a
 * heading of their own.
 */
export interface BriefingTodoEntry {
  id: string;
  title: string;
  status: TodoStatus;
  /**
   * "HH:MM" when the todo carries a clock, "" when it does not — all-day or
   * merely placed on the day (#1369). The host reads it off the same
   * `todoScheduleSlot` the calendar chips do, so the paper and the grid can
   * never disagree about when a todo is.
   */
  startTime: string;
  /** Titles of linked goal/notes (WikiTagsUnified item↔item links). */
  purposes: string[];
}

/** One row of「持ち越し」. */
export interface BriefingCarryoverEntry {
  id: string;
  title: string;
  /** Host-formatted "N日目" label (i18n interpolation stays host-side). */
  daysLabel: string;
  /** True once completed today — kept on the board with a strikethrough. */
  completed: boolean;
}

export interface BriefingData {
  /** Host-formatted date line, e.g. "2026年7月13日 月曜日". */
  dateLine: string;
  /** Extracted briefing (null → "no briefing yet" empty state). */
  briefing: ExtractedBriefing | null;
  schedule: BriefingScheduleEntry[];
  todos: BriefingTodoEntry[];
  carryover: BriefingCarryoverEntry[];
  /**
   * Timer sessions. Not read by this view since #938 — they feed
   * <BriefingVizPanel> in the detail panel, which the same host mounts from
   * this same aggregate.
   */
  sessions: TimerSession[];
  /** Full todo tree — same deal: <BriefingVizPanel>'s completion trend. */
  todoNodes: TodoNode[];
}

export interface BriefingLabels {
  masthead: string;
  focusLabel: string;
  aiTitle: string;
  aiSource: string;
  /** Empty state of the focus line — no focus was written last evening. */
  noFocus: string;
  intentionTitle: string;
  /**
   * Saved-state caption next to the intention title (host-computed).
   * Omitted while the day has no declaration at all — there is no save to
   * report yet, and「保存済み」above an empty field is a lie (#427).
   */
  intentionCaption?: string;
  intentionPlaceholder: string;
  /** Heading of the 週 / 月 / 年 goals block (#872). */
  goalsTitle: string;
  /**
   * Heading of the merged「今日のスケジュール」block (#939) — todos and
   * schedule rows share it now, so it is also the heading a day with todos
   * but no events reads under.
   */
  scheduleTitle: string;
  /** Accessible name + tooltip of the schedule section's「+」 (#623). */
  addScheduleItem: string;
  /** Empty state of the merged block — shown only when BOTH sides are empty. */
  noSchedule: string;
  routineTag: string;
  allDay: string;
  carryoverTitle: string;
  /**
   * Copy for the carryover rows' checkbox (#1368) — `todoStatus` names what
   * the control sets, the two `status*` members name each value. The same
   * words 夕刊 and the Todos section use (todoDetail.*), injected rather than
   * re-worded, because the paper draws the same control they do now.
   */
  todoStatus: string;
  statusNotStarted: string;
  statusDone: string;
  /**
   * Label of every row's jump action —「編集」/ "Edit" (#410). It LEADS the
   * button's accessible name, and `jumpToSchedule` / `jumpToTodos` follow it
   * there and in the hover tooltip, so the name says WHERE the jump lands
   * without contradicting the printed text (WCAG 2.5.3 Label in Name).
   *
   * Printed beside the icon from `md` up; below it the button is icon-only
   * and this word survives in the name alone (#1514).
   */
  edit: string;
  /**
   * Visible label of the row's delete action —「削除」/ "Delete" (#585). Same
   * shape as `edit` for the same reasons: it sits next to a button that reads
   * as text, so an icon-only sibling would be both unreadable at 13px and
   * below the 24×24 target the neighbour already clears.
   */
  delete: string;
  /** Tooltip + accessible-name tail for a schedule row's delete. */
  deleteScheduleHint: string;
  /** Tooltip + accessible-name tail for a todo row's delete. */
  deleteTodoHint: string;
  jumpToSchedule: string;
  jumpToTodos: string;
}

export interface BriefingViewProps {
  loading: boolean;
  data: BriefingData;
  labels: BriefingLabels;
  /**
   * Today's focus line (#1048) — written the previous evening on the 夕刊
   * paper into the reserved focus note (focusSections.ts), NOT read from the
   * daily any more. Null = no focus was written; the line shows its empty
   * state.
   */
  focusText: string | null;
  /** Today's declaration (宣言 — Step 4), newline-separated lines. */
  intentionText: string;
  /** Every keystroke — the host owns draft state + debounced persistence. */
  onIntentionChange: (text: string) => void;
  /** Blur — the host flushes a pending debounced save. */
  onIntentionBlur: () => void;
  /**
   * The CURRENT 週 / 月 / 年 goals (#872) — text per period, newline-separated.
   * They live in one reserved note (goalSections.ts), not in the daily, filed
   * under a period key: when a period turns over its field comes back empty
   * and the previous one stays in the note as history (#957). The paper only
   * ever shows the period `goalLabels` names.
   */
  goals: Record<GoalPeriod, string>;
  /** Copy of the three goal fields, period ranges included (host-formatted). */
  goalLabels: GoalsBlockLabels;
  /** Every keystroke in a goal field — same draft + debounce deal as 宣言. */
  onGoalChange: (period: GoalPeriod, text: string) => void;
  /** Blur on a goal field — the host flushes a pending debounced save. */
  onGoalBlur: () => void;
  /** Completes / un-completes a todo or carryover row (host → DataService). */
  onToggleTodo: (id: string) => void;
  /**
   * Deletes a schedule row (#585). The host decides what "delete" means for
   * the item — a manual event soft-deletes straight away, a routine-derived
   * one first asks which occurrences via Schedule's own RepeatScopeDialog.
   */
  onDeleteScheduleItem: (id: string) => void;
  /** Deletes a todo row (#585) — host → DataService soft delete. */
  onDeleteTodo: (id: string) => void;
  /**
   * Opens the host's creation panel for THIS paper's day (#623). The view
   * holds no creation UI of its own — the host mounts Schedule's shared
   * <ItemCreatePanel> and owns the write.
   */
  onAddScheduleItem: () => void;
  /**
   * Opens ONE event where it lives (host → nav), given its id (#1824).
   *
   * It took no argument until now and the host answered it with a bare section
   * switch, so「編集」landed the reader on the Schedule section with nothing
   * selected and no panel open — the button named an act it did not perform.
   * The id is all the paper can offer; where a row opens is the host's to
   * decide, and the shell already knows how (`navigateToItem`).
   */
  onJumpToSchedule: (id: string) => void;
  /** The same for one todo — the paper's todo rows and its carryover rows. */
  onJumpToTodos: (id: string) => void;
  /**
   * In-body 朝刊/夕刊 switcher for the NARROW layout (#318). AppShell only
   * renders its header slot on the wide branch, so below 768px the
   * SectionHeader tab band — the only way to reach 夕刊 — disappears; the host
   * re-issues it here instead. Left undefined on the wide layout, where the
   * SectionHeader keeps owning the tabs (unchanged).
   *
   * Pass `undefined` / `null` to omit it — NOT `cond && <node>`, whose `false`
   * would clear the guard and leave an empty ruled band on the paper.
   */
  tabSwitcher?: ReactNode;
}

/**
 * Section heading row — 段標 (朱 bar) + small-caps kicker over a hairline.
 *
 * `action` is an optional control pinned to the heading's right edge (#623 —
 * the schedule section's「+」). It shares that edge with `hint`, which is
 * annotation rather than a control, so the two never collide: no section
 * carries both.
 */
function BlockHead({
  title,
  hint,
  action,
}: {
  title: string;
  /* A node, not a string, since #1210: every other section passes plain text,
     but the AI comment's hint is an attribution badge with an icon in it. */
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h3 className="flex items-center gap-2.5 text-xs font-bold tracking-[0.25em] text-lumen-text-secondary">
        <span
          aria-hidden="true"
          className="inline-block h-3.5 w-[7px] bg-lumen-briefing-shu"
        />
        {title}
      </h3>
      {hint !== undefined && (
        <span className={BRIEFING_HINT_CLASS}>{hint}</span>
      )}
      {action}
    </div>
  );
}

/**
 * 「+」on a section heading (#623) — opens the host's creation panel.
 *
 * Icon-only, unlike the row actions, because a heading has no column of
 * sibling buttons to be mistaken for a label of: the accessible name carries
 * the whole meaning and `title` shows it on hover. The padding puts the box at
 * 26×26 with the icon at 14px, and `-my-1` spends the VERTICAL half of that
 * growth on the heading's own whitespace so the rule below it does not move.
 *
 * The horizontal half (`-mr-1.5`) is gone since #1514: these sections carry no
 * side padding, so a row's right edge IS the block's, and a negative margin
 * there hung the box 6px outside its own container. The icon sits 6px in now,
 * exactly where `RowActions` puts the row actions below it — the straight
 * column down the right edge was the only thing that margin bought.
 *
 * The 44px floor (#1559) is bought in two different ways on purpose, because
 * the two directions cost different things:
 *
 *   WIDTH  — `max-md:min-w-11` grows the box. A heading is one short kicker
 *            and a control, so the 18px comes out of slack the h3 was never
 *            using, and the icon lands 22px from the right edge — the same
 *            place the row actions below now centre theirs, so the straight
 *            column the comment above describes is preserved.
 *   HEIGHT — `TAP_TARGET_TALL` instead of `min-h-11`, so the painted box stays
 *            26px tall and the rule below it still does not move. The 9px it
 *            overhangs at each end lands in the section's own `py-5` above and
 *            in `BlockHead`'s 12px `mb-3` below, clearing the first row's own
 *            target by 3px — the check that token's doc-comment asks for.
 */
function BlockHeadAddButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`-my-1 flex flex-shrink-0 items-center justify-center self-center rounded-lumen-sm p-1.5 text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-briefing-shu focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent max-md:min-w-11 ${TAP_TARGET_TALL}`}
    >
      <Plus size={14} aria-hidden="true" />
    </button>
  );
}

/**
 * Right-edge action cluster of a row (#585 — was `EditJumpButton`'s own
 * `ml-auto` before a second action joined it).
 *
 * `ml-auto` pins the cluster to the row's right edge, so the buttons line up
 * in one straight column whatever the titles measure; the old icon-only jump
 * button sat immediately after the title and drifted with it, row by row.
 *
 * `-my-1` lives here rather than on each button: it cancels the vertical half
 * of the padding the buttons need for their 24×24 targets (WCAG 2.5.8), so
 * the boxes grow into the row's own whitespace instead of pushing the row
 * height around.
 *
 * There is no `-mr-1.5` twin any more (#1514). This block has no side padding,
 * so a row's right edge is the block's right edge and there was no whitespace
 * on that side to grow into — the cluster just hung 6px past its own
 * container, which is the 349px-of-content-in-a-343px-box the 390px audit
 * measured. `BlockHeadAddButton` dropped its own in the same change, so the
 *「+」above and the actions below still line up in one straight column.
 *
 * `max-md:w-full` is what puts the cluster on a LINE OF ITS OWN below `md`
 * (#1820). The 44px floor #1559 bought cost the pair 101px of a 343px row, and
 * the only thing left free to shrink was the title: a five-character event
 * title broke across two lines and an 22-character todo across three. A flex
 * item asking for the full width cannot sit beside anything, so it wraps —
 * and the row above it keeps the whole width minus the time column, which is
 * ~200px, enough for ten CJK characters even at the 18px root step. The rows
 * grow taller on a phone in exchange; that is the trade this Issue chose,
 * because a title that cannot be read is not a row at all.
 *
 * `justify-end` rather than the `ml-auto` above, which does nothing once the
 * item IS the line: the cluster still lands on the right edge, under the
 * actions of the row above, so the straight column survives the wrap.
 */
function RowActions({ children }: { children: ReactNode }) {
  return (
    <div className="-my-1 ml-auto flex flex-shrink-0 items-center gap-0.5 self-center max-md:w-full max-md:justify-end">
      {children}
    </div>
  );
}

/*
 * Shape shared by the two row actions.
 *
 * `md:` — not a prop — because this view is pure presentation and the host
 * hands it no width. Tailwind's `md` is rem-based, so it moves with the
 * Settings font scale: the bigger the type, the wider the screen has to be
 * before the labels are offered. That is the behaviour this rule wants, since
 * what runs out at 390px is room for the words themselves (#1514).
 *
 * `gap-1` is `md:` too: with the label hidden it would be 4px of dead space
 * between the icon and the button's right padding.
 *
 * `max-md:min-h-11 max-md:min-w-11` is the 44px floor (#1559), and it grows the
 * BOX rather than hanging an invisible `::after` over it the way the heading's
 * 「+」does. These two sit `gap-0.5` apart: an extension wide enough to reach
 * 44px would reach across its neighbour, so a tap meant for 編集 could answer
 * 削除 — and 削除 is the last button on the paper that may fire by accident.
 *
 * Height is free (every row that draws these is already 44px tall, held there
 * by its own checkbox or by `min-h-11`). Width was not: the pair goes from 58px
 * to 90px, and while the cluster shared a line with the title that came
 * straight off the title — 32px on top of what #1514 had just won back, which
 * is what #1820 measured as a five-character title on two lines. The width is
 * still spent, but `RowActions` now wraps below `md`, so it is spent on a line
 * the title does not use. The words stay hidden below `md` regardless: the
 * cluster sits under the row it belongs to, and two labelled buttons there
 * would read as a second row rather than as that row's actions.
 *
 * `min-*` and never `h-11`/`w-11`: `cn` is a plain string join, so two
 * utilities for one property are settled by Tailwind's emit order rather than
 * by call order (rules/frontend.md §Gotchas).
 */
const ROW_ACTION_BASE =
  "flex items-center justify-center whitespace-nowrap px-1.5 py-1 text-xs transition-colors max-md:min-h-11 max-md:min-w-11 md:gap-1";

/**
 * The action's word —「編集」/「削除」— printed beside its icon on a screen wide
 * enough to hold it (#1514).
 *
 * At 390px it is not: the two labelled buttons took 128px off a 343px row, and
 * what was left squeezed a todo's title to 67px — three lines of broken word
 * for one 18-character todo. Hiding the words gives the title back ~77px and
 * gets it onto one line.
 *
 * `hidden md:inline` rather than dropping the text from the tree: the
 * accessible name is composed from this same label (「編集: スケジュールで開く」),
 * and WCAG 2.5.3 (Label in Name) only binds while the label is VISIBLE — so a
 * narrow screen loses the printed word and keeps every name a screen reader
 * and a voice-control user hear.
 */
function RowActionLabel({ label }: { label: string }) {
  return <span className="hidden md:inline">{label}</span>;
}

/*
 * Icon size of a row action. 16px while the word is hidden, back to the 13px
 * #410 chose once it is printed: a 13px arrow alone was the very thing that
 * issue called too small to read as an action, and below `md` it now stands
 * alone. Set in CSS rather than through lucide's `size` prop so it can answer
 * the breakpoint at all (the prop writes width/height ATTRIBUTES, which any
 * class overrides).
 */
const ROW_ACTION_ICON = "size-4 shrink-0 md:size-[13px]";

/**
 * Row jump action —「編集」+ ↗ (#410).
 *
 * The label is printed because a 13px arrow alone was too small to read as an
 * action — and too small to hit. Below `md` there is no room for the word
 * next to a todo's title (#1514), so it steps back to the icon and the icon
 * grows to 16px to answer the same objection.
 *
 * The accessible name leads with that visible label and only then says where
 * the jump lands (「編集: スケジュールで開く」). Naming it `編集` alone would
 * leave six identically-named buttons on the paper, and dropping the label
 * from the name to keep the longer wording would break WCAG 2.5.3 (Label in
 * Name) — voice control users say what they see. `title` keeps the pointer
 * tooltip; it is not a substitute, since touch never shows it.
 */
function EditJumpButton({
  onClick,
  label,
  hint,
}: {
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${hint}`}
      title={hint}
      className={`${ROW_ACTION_BASE} text-lumen-text-secondary hover:text-lumen-accent`}
    >
      <ArrowUpRight aria-hidden="true" className={ROW_ACTION_ICON} />
      <RowActionLabel label={label} />
    </button>
  );
}

/**
 * Row delete action —「削除」+ 🗑 (#585). Deliberately the same shape, size and
 * naming rule as its `EditJumpButton` neighbour: two adjacent actions where
 * only one carries text would read as a label with an ornament, and the
 * destructive one is the last place to shrink the hit target. Only the hover
 * colour differs (danger, not accent) — the resting state stays quiet so the
 * paper does not turn into a row of red buttons.
 */
function DeleteRowButton({
  onClick,
  label,
  hint,
}: {
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${hint}`}
      title={hint}
      className={`${ROW_ACTION_BASE} text-lumen-text-secondary hover:text-lumen-danger`}
    >
      <Trash2 aria-hidden="true" className={ROW_ACTION_ICON} />
      <RowActionLabel label={label} />
    </button>
  );
}

/*
 * The time column of 「今日のスケジュール」— one width and one type style for every row
 * in the block, event or todo (#1369). A timed todo prints its HH:MM exactly
 * where an event prints its own; anything else hands this an empty label and
 * gets a spacer, which holds the column open so every title stays on one
 * straight edge without printing a blank the reader could mistake for a
 * missing time.
 */
function TimeCell({ label }: { label: string }) {
  if (label === "") {
    return <span aria-hidden="true" className="w-14 flex-shrink-0" />;
  }
  return (
    <span className="w-14 flex-shrink-0 text-xs font-bold tabular-nums text-lumen-briefing-shu">
      {label}
    </span>
  );
}

export function BriefingView({
  loading,
  data,
  labels,
  focusText,
  intentionText,
  onIntentionChange,
  onIntentionBlur,
  goals,
  goalLabels,
  onGoalChange,
  onGoalBlur,
  onToggleTodo,
  onDeleteScheduleItem,
  onDeleteTodo,
  onAddScheduleItem,
  onJumpToSchedule,
  onJumpToTodos,
  tabSwitcher,
}: BriefingViewProps): React.JSX.Element {
  if (loading) {
    // The switcher rides along the skeleton too — a slow fetch must never
    // strand a narrow-width reader on the tab they can no longer leave.
    return (
      <div className="mx-auto w-full max-w-2xl py-8">
        {tabSwitcher != null && <div className="mb-4 px-2">{tabSwitcher}</div>}
        <SkeletonList rows={8} rowHeight={44} gap={12} />
      </div>
    );
  }

  const { briefing } = data;

  // All-day rows first, then the timed ones (#939). The host already sorts
  // this way, but the divider's position is a promise the view makes — it has
  // to sit between the todos and the FIRST all-day row — so the grouping is
  // re-stated here instead of being inherited silently. Stable partition: the
  // host's order inside each group is untouched.
  const scheduleRows = [
    ...data.schedule.filter((item) => item.isAllDay),
    ...data.schedule.filter((item) => !item.isAllDay),
  ];

  return (
    <div className="mx-auto w-full max-w-2xl pb-16">
      {/* ── 朝刊/夕刊 switcher — narrow layout only (#318) ──────────
          ABOVE the masthead (#879): the band carries the hamburger that
          opens the drawer (#609), and every other section draws that row at
          the very top of the page (PageContainer's header slot). Below the
          title it was Briefing's own header order, one screen out of step
          with the rest. On the wide layout the slot is undefined, so the
          paper still opens on its masthead — nothing moves there. */}
      {tabSwitcher != null && (
        <div className="border-b border-lumen-border px-2 py-3">
          {tabSwitcher}
        </div>
      )}

      {/* ── Masthead — the title and the focus line below deliberately keep
          the newspaper serif (#269) regardless of the Settings font; body
          copy follows the global preference (#556).

          `break-keep` because the nameplate reads 「LIFE EDITOR 朝刊」and CJK
          text may wrap between ANY two characters by default. At 390px the
          line ran out one glyph early and the paper printed 「LIFE EDITOR 夕」
          over 「刊」— a two-character word cut in half (#1513). keep-all
          removes those inter-character break points, leaving the space before
          the paper's name as the only one, so a narrow screen gets
          「LIFE EDITOR」over 「朝刊」and a wide screen is untouched. The
          English nameplate ("LIFE EDITOR BRIEFING") already broke at spaces
          only, so en sees no change. ────────────────────────────── */}
      <header className="border-b-4 border-double border-lumen-border-strong pb-4 pt-6 text-center">
        <h2 className="break-keep font-serif text-2xl font-semibold tracking-[0.3em] text-lumen-text">
          {labels.masthead}
        </h2>
        <p className="mt-2 text-xs tracking-[0.2em] text-lumen-text-secondary">
          {data.dateLine}
        </p>
      </header>

      {/* ── Focus line — written last evening on the 夕刊 (#1048) ── */}
      <section className="border-b border-lumen-border px-2 py-6 text-center">
        <p className="mb-2 text-xs font-bold tracking-[0.3em] text-lumen-briefing-shu">
          {labels.focusLabel}
        </p>
        {focusText !== null ? (
          focusText.split("\n").map((line, i) => (
            <p
              key={i}
              className="font-serif text-xl font-semibold leading-relaxed text-lumen-text"
            >
              {line}
            </p>
          ))
        ) : (
          /* `items-start` and not `items-center` (#1826). The sentence wraps
             to three lines at 390px, and a centred icon floated beside the
             SECOND one — it read as a bullet on the middle of the sentence
             rather than as the mark in front of it. Starting the cross axis
             puts it beside the first line at every width; `mt-0.5` is the 2px
             that lines the 16px glyph up with the cap height of 20px text
             instead of with its ascender. */
          <p className="flex items-start justify-center gap-2 text-sm text-lumen-text-secondary">
            <Sunrise size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
            {labels.noFocus}
          </p>
        )}
      </section>

      {/* ── AI comment (rest of the briefing section) ────────────── */}
      {briefing !== null && briefing.paragraphs.length > 0 && (
        <section className="border-b border-lumen-border py-5">
          {/*
           * Attribution badge (#1210). The wording is untouched — `aiSource`
           * has said "Claude ・ from the Briefing section" since the block
           * shipped — but it said it in the same small grey type every other
           * section's hint uses, so the one paragraph on this page that was
           * not written by the user read exactly like the ones that were. The
           * icon and the bordered pill are the whole change: the same words,
           * given a shape that separates them from an annotation.
           */}
          <BlockHead
            title={labels.aiTitle}
            hint={
              <span
                /* Colour and size come from BlockHead's own hint span, which
                   already wears BRIEFING_HINT_CLASS — this adds only shape. */
                className="inline-flex items-center gap-1 rounded-full border border-lumen-briefing-kohaku px-2 py-0.5"
              >
                <Sparkles size={11} aria-hidden="true" />
                {labels.aiSource}
              </span>
            }
          />
          <div className="rounded-lumen-md border-l-2 border-lumen-briefing-kohaku bg-lumen-briefing-kohaku-subtle px-4 py-3">
            {briefing.paragraphs.map((text, i) => (
              <p
                key={i}
                className="text-sm leading-relaxed text-lumen-text [&+&]:mt-2"
              >
                {text}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* ── Today's intention (宣言 — Step 4) ────────────────────── */}
      <section className="border-b border-lumen-border py-5">
        <BlockHead
          title={labels.intentionTitle}
          hint={labels.intentionCaption}
        />
        <IntentionField
          value={intentionText}
          placeholder={labels.intentionPlaceholder}
          onChange={onIntentionChange}
          onBlur={onIntentionBlur}
        />
      </section>

      {/* ── Standing goals: week → month → year (#872) ───────────── */}
      <section className="border-b border-lumen-border py-5">
        <BlockHead title={labels.goalsTitle} />
        <GoalsBlock
          values={goals}
          labels={goalLabels}
          onChange={onGoalChange}
          onBlur={onGoalBlur}
        />
      </section>

      {/* ── Today's schedule — todos ride on top of it (#939) ────────
          One list, not two sections: a todo placed on today and an all-day
          event are the same promise to the reader, and the old separate
          「今日の Todo と、その目的」heading made the page ask twice what the
          day holds. Order is todos → hairline → all-day → timed, so the rows
          run from "no clock at all" down to "at 09:00". */}
      <section className="border-b border-lumen-border py-5">
        <BlockHead
          title={labels.scheduleTitle}
          action={
            <BlockHeadAddButton
              onClick={onAddScheduleItem}
              label={labels.addScheduleItem}
            />
          }
        />
        {data.todos.length === 0 && data.schedule.length === 0 ? (
          <p className="text-sm text-lumen-text-secondary">
            {labels.noSchedule}
          </p>
        ) : (
          <ul className="space-y-1">
            {data.todos.map((todo) => (
              <li key={todo.id}>
                {/* One height for every row in this list (#1442). The shared
                    checkbox carries the 44px touch floor, so a row holding one
                    is 44px tall — and the schedule rows below claim the same
                    minimum rather than letting the list step down at the point
                    where the todos end.

                    `flex-wrap` below `md` (#1820) so the action cluster drops
                    to its own line and the title keeps the width; `gap-y-1`
                    is the space between those two lines and costs nothing
                    while the row is unwrapped. `md:flex-nowrap` pins the
                    Desktop row to one line whatever the title measures. */}
                <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 md:flex-nowrap">
                  {/* Same column, same format as the timed rows below — a
                      todo placed at 09:00 has to read as 09:00 here too
                      (#1369). Untimed todos pass "" and get the spacer that
                      used to be unconditional. */}
                  <TimeCell label={todo.startTime} />
                  {/* The same control the carryover rows draw (#1442) — the
                      paper had a 16px hand-drawn box here and the shared 20px
                      glyph a few rows down, so one page showed two kinds of
                      checkbox. It sits beside the title button, not inside it:
                      it is a button itself, and this file's a11y invariant is
                      that no button nests in another. 朱 rather than the app
                      accent, as on the carryover rows and 夕刊.
                      `itemName` is the row's own title (#1486): the paper can
                      print five todos, and a checkbox that only says
                     「ステータス: 未着手」leaves the reader who cannot see the
                      title beside it with five identical controls. */}
                  <TodoStatusCheckbox
                    status={todo.status}
                    onChange={() => onToggleTodo(todo.id)}
                    labels={labels}
                    label={labels.todoStatus}
                    itemName={todo.title}
                    accentClassName="text-lumen-briefing-shu"
                  />
                  <button
                    type="button"
                    onClick={() => onToggleTodo(todo.id)}
                    className="min-w-0 text-left"
                  >
                    <span
                      className={
                        todo.status === "DONE"
                          ? "text-sm text-lumen-text-secondary line-through"
                          : "text-sm text-lumen-text"
                      }
                    >
                      {todo.title}
                    </span>
                  </button>
                  <RowActions>
                    <EditJumpButton
                      onClick={() => onJumpToTodos(todo.id)}
                      label={labels.edit}
                      hint={labels.jumpToTodos}
                    />
                    <DeleteRowButton
                      onClick={() => onDeleteTodo(todo.id)}
                      label={labels.delete}
                      hint={labels.deleteTodoHint}
                    />
                  </RowActions>
                </div>
                {/* Indented past the empty time column + checkbox so the
                    purpose hangs under its own todo's title: the time column
                    (`w-14` = 3.5rem), the `gap-3` (0.75rem), the checkbox
                    (`min-w-11` = 2.75rem) and the second `gap-3`.

                    In rem and never in px (#1821). Every one of those four
                    widths is rem-based, so at the 18px root step the columns
                    measure 139.5px while a fixed `ml-[124px]` stayed put — the
                    purpose line started 16px to the LEFT of the title it hangs
                    under, on Desktop and on a phone alike. 3.5 + 0.75 + 2.75 +
                    0.75 = 7.75rem, which is the same 124px at the 16px root and
                    follows the column at every other step. */}
                {todo.purposes.length > 0 && (
                  <p className="ml-[7.75rem] mt-0.5 text-xs text-lumen-text-secondary">
                    <span className="font-semibold text-lumen-briefing-kohaku">
                      ◈ {todo.purposes.join(" ・ ")}
                    </span>
                  </p>
                )}
              </li>
            ))}
            {/* The hairline between the two kinds of row. Decorative only —
                it separates, it is not an item — and omitted entirely when
                one side of it is empty. */}
            {data.todos.length > 0 && data.schedule.length > 0 && (
              <li
                aria-hidden="true"
                className="my-1.5 border-t border-lumen-border"
              />
            )}
            {scheduleRows.map((item) => (
              <li
                key={item.id}
                className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 md:flex-nowrap"
              >
                <TimeCell
                  label={item.isAllDay ? labels.allDay : item.startTime}
                />
                {/* No completion mark and no strikethrough (#1373): an event
                    has no "done" any more, so the paper reads the schedule
                    rather than asking the user to tick it off. The todo rows
                    below keep their checkbox. */}
                <span className="min-w-0 text-sm text-lumen-text">
                  {item.title}
                </span>
                {item.isRoutine && (
                  <span className="rounded-full border border-lumen-briefing-kohaku bg-lumen-briefing-kohaku-subtle px-2 text-xs text-lumen-briefing-kohaku">
                    {labels.routineTag}
                  </span>
                )}
                {/* Last in the row so `ml-auto` lands it on the right edge —
                    the routine tag keeps its place beside the title. Below
                    `md` the cluster takes the next line instead (#1820) and
                    the tag stays up here with the title. */}
                <RowActions>
                  <EditJumpButton
                    onClick={() => onJumpToSchedule(item.id)}
                    label={labels.edit}
                    hint={labels.jumpToSchedule}
                  />
                  <DeleteRowButton
                    onClick={() => onDeleteScheduleItem(item.id)}
                    label={labels.delete}
                    hint={labels.deleteScheduleHint}
                  />
                </RowActions>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Carryover ─────────────────────────────────────────────
          The paper's last section now that「きのうまでの自分」has moved to the
          detail panel (#938). No border of its own, as before: the rule above
          it is the previous section's `border-b`, so the ruled rhythm is
          unchanged by the removal. */}
      {data.carryover.length > 0 && (
        <section className="py-5">
          <BlockHead title={labels.carryoverTitle} />
          <ul className="space-y-1">
            {data.carryover.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 text-sm text-lumen-text-secondary"
              >
                {/* The paper's left rail, held at the width the schedule rows
                    hold it (#1368). The label is「3日目」on one row and
                    「12日目」on the next, so a column that sizes itself to its
                    own text hands each row a different left edge — and the
                    checkbox after it visibly steps sideways down the list.
                    tabular-nums keeps the digits themselves from stepping. */}
                <span className="w-14 flex-shrink-0 text-xs font-bold tabular-nums text-lumen-briefing-shu">
                  {item.daysLabel}
                </span>
                {/* The one todo checkbox (#1368). 朱 rather than the app
                    accent, as on 夕刊: a mark the user made is the paper's own
                    voice, not the app's. */}
                <TodoStatusCheckbox
                  status={item.completed ? "DONE" : "NOT_STARTED"}
                  onChange={() => onToggleTodo(item.id)}
                  labels={labels}
                  label={labels.todoStatus}
                  accentClassName="text-lumen-briefing-shu"
                />
                <button
                  type="button"
                  onClick={() => onToggleTodo(item.id)}
                  className="min-w-0 text-left"
                >
                  <span className={item.completed ? "line-through" : undefined}>
                    {item.title}
                  </span>
                </button>
                {/* Carryover keeps the jump alone: #585 scopes the delete to
                    今日のスケジュール and 今日の Todo, and a carryover row is
                    a past day's todo showing through — deleting it here would
                    act on a day the paper is not editing. */}
                <RowActions>
                  <EditJumpButton
                    onClick={() => onJumpToTodos(item.id)}
                    label={labels.edit}
                    hint={labels.jumpToTodos}
                  />
                </RowActions>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
```

### shared/src/components/briefing/EveningView.tsx（夕刊の紙面・全文）

```tsx
import type { ReactNode } from "react";
import { Star } from "lucide-react";
import type { TodoStatus } from "../../types/todoTree";
import { SkeletonList } from "../SkeletonList";
import { TodoStatusCheckbox } from "../TodoStatusCheckbox";
import { IntentionField } from "./IntentionField";

/*
 * EveningView — the evening-paper (夕刊) closing surface (#263, F-6).
 *
 * Pure presentation (§6.4): no DataService, no useTranslation — the host
 * (web/src/briefing/BriefingScreen.tsx) aggregates data, owns the section-
 * merge persistence, and injects everything through props. The TipTap editor
 * is a host concern too (it lives in web/), so it arrives as `editorSlot`.
 * Layout language matches BriefingView's 紙面: centered reading column,
 * double-rule masthead, 朱 (lumen-briefing-shu) for marks, 琥珀
 * (lumen-briefing-kohaku) for annotations — lumen-* tokens only.
 *
 * Neither the remaining-todo nor the upcoming-schedule block is ever copied
 * into the daily body (F-6: analysis reads raw data via get_today_context; the
 * body is the user's own reflection). The todo rows are still ACTIONABLE
 * though — closing the day means moving things along, and #796 gave them the
 * same three statuses a Todo has everywhere else in the app.
 */

/** One row of「残りの Todo」(today's unfinished + open carryover). */
export interface EveningTodoEntry {
  id: string;
  title: string;
  /** Optional annotation, e.g. the carryover "N日目" label (host-formatted). */
  meta?: string;
  /**
   * Not started / In progress / Done — the Todo's real state, not a boolean
   * flattening of it (#796). A row moved to DONE **today** stays on the list
   * struck through rather than vanishing under the finger that tapped it.
   */
  status: TodoStatus;
}

/** One read-only row of「今後の予定」(rest of today + tomorrow). */
export interface EveningScheduleEntry {
  id: string;
  title: string;
  /** "HH:MM" (empty for all-day). */
  startTime: string;
  isAllDay: boolean;
  /** True for tomorrow's items — rendered with the tomorrow tag. */
  isTomorrow: boolean;
}

export interface EveningLabels {
  masthead: string;
  moodTitle: string;
  /** Aria labels for the five stars, index 0 =「気分 1/5」etc. */
  moodStars: string[];
  /**
   * Heading of the 宣言 block. The host swaps the copy with the mode:
   * 「今朝の宣言」when it is the read-back of a morning artifact,
   * 「今日の宣言」when the narrow layout makes it a live input (#391).
   */
  intentionTitle: string;
  /**
   * Saved-state caption for the 宣言 block (host-computed). Rendered ONLY
   * while the block is editable — a read-only block has no save to report,
   * and a「保存済み」next to text you cannot type into is a lie. Also
   * omitted while the day has no declaration at all (#427).
   */
  intentionCaption?: string;
  /** Placeholder of the editable 宣言 field (narrow layout only). */
  intentionPlaceholder: string;
  reflectionTitle: string;
  /**
   * Saved-state caption next to the reflection title (host-computed).
   *
   * Omitted while the day holds no reflection and no mood (#1822) — the same
   * rule `intentionCaption` follows. A「保存済み」beside an empty page is a
   * receipt for a write that never happened.
   */
  savedCaption?: string;
  /**
   * Heading of the 明日のフォーカス block (#1048) — the input whose text
   * TOMORROW's morning paper prints as its focus line.
   */
  focusTitle: string;
  /** Placeholder of the focus field. */
  focusPlaceholder: string;
  todosTitle: string;
  noTodos: string;
  /**
   * Copy for the per-row status control (#796) — `todoStatus` names what the
   * button controls, the three `status*` members name each value. Same words
   * the Todos section uses (todoDetail.*), injected rather than re-worded.
   */
  todoStatus: string;
  statusNotStarted: string;
  statusDone: string;
  upcomingTitle: string;
  noUpcoming: string;
  tomorrowTag: string;
  allDay: string;
}

export interface EveningViewProps {
  loading: boolean;
  /** Host-formatted date line, e.g. "2026年7月18日 土曜日". */
  dateLine: string;
  /** Current mood 1–5 (persisted or draft), null when unset. */
  mood: number | null;
  /** Star tap — host persists「気分: n/5」(tapping the current value clears). */
  onSelectMood: (mood: number) => void;
  /** The host-mounted TipTap editor bound to the evening section body. */
  editorSlot: ReactNode;
  /**
   * Today's declaration (宣言 section, newline-separated). Empty string = no
   * declaration yet, which hides the whole block on the read-only (wide) path.
   */
  intentionText: string;
  /**
   * Turns the 宣言 block from a read-back into a live input (#391).
   *
   * Wide keeps the original reading: the declaration is a MORNING artifact the
   * evening paper shows back, and the SectionHeader tab band puts the editable
   * 朝刊 one click away. Below 768px the evening paper is a Quick capture
   * surface (mobile-scope #3) and the tab band is an in-body switcher, so the
   * block becomes the input itself — otherwise a phone user who lands on 夕刊
   * cannot declare at all (and gets no block whatsoever on a blank day).
   */
  intentionEditable: boolean;
  /** Every keystroke while editable — the host owns draft + debounced save. */
  onIntentionChange: (text: string) => void;
  /** Blur while editable — the host flushes a pending debounced save. */
  onIntentionBlur: () => void;
  /**
   * Tomorrow's focus (#1048) — the draft-or-stored text of the focus note's
   * section keyed to TOMORROW. Writing it here is part of closing the day;
   * the next morning's paper prints it as「今日のフォーカス」. Editable at
   * every width, like the mood stars.
   */
  focusText: string;
  /** Every keystroke in the focus field — host owns draft + debounced save. */
  onFocusChange: (text: string) => void;
  /** Blur on the focus field — the host flushes a pending debounced save. */
  onFocusBlur: () => void;
  todos: EveningTodoEntry[];
  /**
   * Move a todo to the next status straight from the paper (#796). The block
   * used to draw a checkbox-shaped <span> with nothing listening to it, which
   * both flattened three states into two and left the row unpressable.
   */
  onSetTodoStatus: (id: string, status: TodoStatus) => void;
  schedule: EveningScheduleEntry[];
  labels: EveningLabels;
  /**
   * In-body 朝刊/夕刊 switcher for the NARROW layout (#318) — same slot as
   * BriefingView's. AppShell renders its header slot on the wide branch only,
   * so below 768px the host re-issues the tab band here. Undefined on the wide
   * layout, where the SectionHeader keeps owning the tabs (unchanged).
   *
   * Pass `undefined` / `null` to omit it — NOT `cond && <node>`, whose `false`
   * would clear the guard and leave an empty ruled band on the paper.
   */
  tabSwitcher?: ReactNode;
}

/** Section heading row — same 段標 idiom as BriefingView's BlockHead. */
function BlockHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h3 className="flex items-center gap-2.5 text-xs font-bold tracking-[0.25em] text-lumen-text-secondary">
        <span
          aria-hidden="true"
          className="inline-block h-3.5 w-[7px] bg-lumen-briefing-shu"
        />
        {title}
      </h3>
      {hint !== undefined && (
        <span className="text-xs tracking-wider text-lumen-briefing-kohaku">
          {hint}
        </span>
      )}
    </div>
  );
}

/*
 * One mood star's box (#1559).
 *
 * The 390px audit measured these at 35×35: a 26px glyph in `p-1`. Five of them
 * sit `gap-1.5` apart in a centred row, so the floor is bought by growing the
 * BOXES rather than by hanging a `::after` over each — the extensions of two
 * neighbours 6px apart would overlap and the row would answer the wrong star.
 * Five 44px boxes plus four 6px gaps come to 244px, well inside the 343px the
 * paper prints on, so nothing is displaced by the growth.
 *
 * `max-md:` and never a bare `min-h-11`: one component draws this row at every
 * width, and the Desktop star is the 34px box #263 chose.
 *
 * `inline-flex` + centring is what makes the floor mean anything — without it
 * the glyph would sit against the box's leading edge once the box is wider
 * than its content. It is a no-op at Desktop size, where the box already hugs
 * the 26px star.
 */
const MOOD_STAR_BASE =
  "inline-flex items-center justify-center p-1 transition-transform hover:scale-110 max-md:min-h-11 max-md:min-w-11";

export function EveningView({
  loading,
  dateLine,
  mood,
  onSelectMood,
  editorSlot,
  intentionText,
  intentionEditable,
  onIntentionChange,
  onIntentionBlur,
  focusText,
  onFocusChange,
  onFocusBlur,
  todos,
  onSetTodoStatus,
  schedule,
  labels,
  tabSwitcher,
}: EveningViewProps): React.JSX.Element {
  if (loading) {
    // Mirrors BriefingView: the switcher stays reachable while data loads.
    return (
      <div className="mx-auto w-full max-w-2xl py-8">
        {tabSwitcher != null && <div className="mb-4 px-2">{tabSwitcher}</div>}
        <SkeletonList rows={8} rowHeight={44} gap={12} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl pb-16">
      {/* ── 朝刊/夕刊 switcher — narrow layout only (#318) ──────────
          ABOVE the masthead (#879), same order as the morning paper: the
          hamburger row belongs at the top of the screen the way every other
          section draws it. Undefined on the wide layout — nothing moves. */}
      {tabSwitcher != null && (
        <div className="border-b border-lumen-border px-2 py-3">
          {tabSwitcher}
        </div>
      )}

      {/* ── Masthead — the title deliberately keeps the newspaper serif
          (#269) regardless of the Settings font; body copy follows the
          global preference (#556). `break-keep` for the same reason the
          morning paper carries it: 「LIFE EDITOR 夕刊」wrapped between 夕 and
          刊 at 390px, and keep-all leaves the space before the paper's name
          as the only break point (#1513). ─────────────────────────── */}
      <header className="border-b-4 border-double border-lumen-border-strong pb-4 pt-6 text-center">
        <h2 className="break-keep font-serif text-2xl font-semibold tracking-[0.3em] text-lumen-text">
          {labels.masthead}
        </h2>
        <p className="mt-2 text-xs tracking-[0.2em] text-lumen-text-secondary">
          {dateLine}
        </p>
      </header>

      {/* ── Mood (気分: n/5 convention behind the stars) ─────────── */}
      <section className="border-b border-lumen-border px-2 py-6 text-center">
        <p className="mb-3 text-xs font-bold tracking-[0.3em] text-lumen-briefing-shu">
          {labels.moodTitle}
        </p>
        <div className="flex items-center justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = mood !== null && n <= mood;
            return (
              <button
                key={n}
                type="button"
                onClick={() => onSelectMood(n)}
                aria-label={labels.moodStars[n - 1]}
                aria-pressed={mood === n}
                className={
                  filled
                    ? `${MOOD_STAR_BASE} text-lumen-briefing-shu`
                    : `${MOOD_STAR_BASE} text-lumen-text-secondary hover:text-lumen-briefing-shu`
                }
              >
                <Star
                  size={26}
                  aria-hidden="true"
                  fill={filled ? "currentColor" : "none"}
                />
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Today's intention (宣言) — input on narrow, read-back on wide ─ */}
      {(intentionEditable || intentionText !== "") && (
        <section className="border-b border-lumen-border py-5">
          <BlockHead
            title={labels.intentionTitle}
            hint={intentionEditable ? labels.intentionCaption : undefined}
          />
          {intentionEditable ? (
            // 朱 (the user's action voice) — same field as the morning paper.
            <IntentionField
              value={intentionText}
              placeholder={labels.intentionPlaceholder}
              onChange={onIntentionChange}
              onBlur={onIntentionBlur}
            />
          ) : (
            // 琥珀 (context / annotation) — a morning artifact read back.
            <div className="rounded-lumen-md border-l-2 border-lumen-briefing-kohaku bg-lumen-briefing-kohaku-subtle px-4 py-3">
              {intentionText.split("\n").map((line, i) => (
                <p
                  key={i}
                  className="text-sm leading-relaxed text-lumen-text [&+&]:mt-1"
                >
                  {line}
                </p>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Reflection (the evening editor — host-mounted TipTap) ── */}
      <section className="border-b border-lumen-border py-5">
        <BlockHead title={labels.reflectionTitle} hint={labels.savedCaption} />
        <div className="rounded-lumen-md border border-lumen-border bg-lumen-surface">
          {editorSlot}
        </div>
      </section>

      {/* ── Tomorrow's focus (#1048) — 朱, the user's own action voice:
          closing today includes deciding tomorrow. The text lands in the
          reserved focus note keyed to tomorrow, and tomorrow's morning
          paper prints it as its focus line. ─────────────────────── */}
      <section className="border-b border-lumen-border py-5">
        <BlockHead title={labels.focusTitle} />
        <IntentionField
          value={focusText}
          placeholder={labels.focusPlaceholder}
          onChange={onFocusChange}
          onBlur={onFocusBlur}
        />
      </section>

      {/* ── Remaining todos (display only) ───────────────────────── */}
      <section className="border-b border-lumen-border py-5">
        <BlockHead title={labels.todosTitle} />
        {todos.length === 0 ? (
          <p className="text-sm text-lumen-text-secondary">{labels.noTodos}</p>
        ) : (
          <ul>
            {todos.map((todo) => (
              <li
                key={todo.id}
                className="flex items-center gap-1.5 border-b border-dashed border-lumen-border last:border-b-0"
              >
                {/* 朱 is the user's own action voice on the paper, so the
                    control wears it rather than the app accent. */}
                <TodoStatusCheckbox
                  status={todo.status}
                  onChange={(next) => onSetTodoStatus(todo.id, next)}
                  labels={labels}
                  label={labels.todoStatus}
                  accentClassName="text-lumen-briefing-shu"
                />
                <span
                  className={
                    todo.status === "DONE"
                      ? "text-sm text-lumen-text-secondary line-through"
                      : "text-sm text-lumen-text"
                  }
                >
                  {todo.title}
                </span>
                {todo.meta !== undefined && (
                  <span className="text-xs font-bold text-lumen-briefing-shu">
                    {todo.meta}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Upcoming schedule (display only) ─────────────────────── */}
      <section className="py-5">
        <BlockHead title={labels.upcomingTitle} />
        {schedule.length === 0 ? (
          <p className="text-sm text-lumen-text-secondary">
            {labels.noUpcoming}
          </p>
        ) : (
          <ul className="space-y-1">
            {schedule.map((item) => (
              <li key={item.id} className="flex items-baseline gap-3 py-1">
                <span className="w-14 flex-shrink-0 text-xs font-bold tabular-nums text-lumen-briefing-shu">
                  {item.isAllDay ? labels.allDay : item.startTime}
                </span>
                <span className="text-sm text-lumen-text">{item.title}</span>
                {item.isTomorrow && (
                  <span className="rounded-full border border-lumen-briefing-kohaku bg-lumen-briefing-kohaku-subtle px-2 text-xs text-lumen-briefing-kohaku">
                    {labels.tomorrowTag}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

### shared/src/components/briefing/GoalsBlock.tsx（目標のブロック・コメントを除いた形）

```tsx
import { BRIEFING_HINT_CLASS } from "./briefingStyles";
import { IntentionField } from "./IntentionField";
import { GOAL_PERIODS, type GoalPeriod } from "./goalSections";
export interface GoalFieldLabels {
  title: string;
  range: string;
  placeholder: string;
}
export type GoalsBlockLabels = Record<GoalPeriod, GoalFieldLabels>;
export interface GoalsBlockProps {
  values: Record<GoalPeriod, string>;
  labels: GoalsBlockLabels;
  onChange: (period: GoalPeriod, text: string) => void;
  onBlur: () => void;
}
export function GoalsBlock({
  values,
  labels,
  onChange,
  onBlur,
}: GoalsBlockProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      {GOAL_PERIODS.map((period) => (
        <div key={period}>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <h4
              id={`briefing-goal-${period}`}
              className="text-xs font-bold tracking-[0.2em] text-lumen-text-secondary"
            >
              {labels[period].title}
            </h4>
            <span className={BRIEFING_HINT_CLASS}>{labels[period].range}</span>
          </div>
          <IntentionField
            value={values[period]}
            placeholder={labels[period].placeholder}
            onChange={(text) => onChange(period, text)}
            onBlur={onBlur}
            labelledBy={`briefing-goal-${period}`}
          />
        </div>
      ))}
    </div>
  );
}
```

### shared/src/components/briefing/IntentionField.tsx（宣言・目標・フォーカスの入力欄・コメントを除いた形）

```tsx
import { useEffect, useRef } from "react";
export interface IntentionFieldProps {
  value: string;
  placeholder: string;
  onChange: (text: string) => void;
  onBlur: () => void;
  labelledBy?: string;
}
export function IntentionField({
  value,
  placeholder,
  onChange,
  onBlur,
  labelledBy,
}: IntentionFieldProps): React.JSX.Element {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      placeholder={placeholder}
      aria-labelledby={labelledBy}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className="w-full resize-none overflow-hidden rounded-lumen-md border-l-2 border-lumen-briefing-shu bg-lumen-briefing-shu-subtle px-4 py-3 text-base leading-relaxed text-lumen-text outline-none placeholder:text-sm placeholder:text-lumen-text-secondary"
    />
  );
}
```

### shared/src/components/briefing/EveningReflectionPreview.tsx（締めくくりの表示状態・コメントを除いた形）

```tsx
import { cn } from "../cn";
import { FOCUS_RING } from "../styleTokens";
export interface EveningReflectionPreviewProps {
  lines: readonly string[];
  placeholder: string;
  editLabel: string;
  onStartEditing: () => void;
  onPrefetch?: () => void;
  className?: string;
}
export function EveningReflectionPreview({
  lines,
  placeholder,
  editLabel,
  onStartEditing,
  onPrefetch,
  className,
}: EveningReflectionPreviewProps) {
  return (
    <button
      type="button"
      aria-label={[editLabel, ...lines].join(" ")}
      onClick={onStartEditing}
      onPointerEnter={onPrefetch}
      onFocus={onPrefetch}
      className={cn(
        "flex w-full flex-col justify-start text-left",
        "rounded-md transition-colors hover:bg-lumen-hover",
        FOCUS_RING,
        className,
      )}
    >
      {lines.length === 0 ? (
        <p className="text-sm leading-relaxed text-lumen-text-secondary">
          {placeholder}
        </p>
      ) : (
        lines.map((line, i) => (
          <p
            key={i}
            className="text-sm leading-relaxed text-lumen-text [&+&]:mt-1"
          >
            {line}
          </p>
        ))
      )}
    </button>
  );
}
```

### shared/src/components/briefing/briefingStyles.ts（紙面で共有するクラス・コメントを除いた形）

```ts
export const BRIEFING_HINT_CLASS =
  "text-xs tracking-wider text-lumen-briefing-kohaku";
```

### shared/src/components/briefing/BriefingVizPanel.tsx（詳細パネルの「きのうまでの自分」・コメントを除いた形）

```tsx
import { lazy, Suspense } from "react";
import type { TodoNode } from "../../types/todoTree";
import type { TimerSession } from "../../types/timer";
import {
  StreakDisplay,
  type StreakDisplayLabels,
} from "../Analytics/StreakDisplay";
import type { TodoCompletionTrendLabels } from "../Analytics/TodoCompletionTrend";
import type { WorkBreakBalanceLabels } from "../Analytics/WorkBreakBalance";
import { ChartCard } from "../Analytics/ChartCard";
import { CHART_HEIGHT_MD } from "../Analytics/chartTheme";
const TodoCompletionTrend = lazy(() =>
  import("../Analytics/TodoCompletionTrend").then((m) => ({
    default: m.TodoCompletionTrend,
  })),
);
const WorkBreakBalance = lazy(() =>
  import("../Analytics/WorkBreakBalance").then((m) => ({
    default: m.WorkBreakBalance,
  })),
);
function ChartPlaceholder({ title }: { title: string }) {
  return (
    <ChartCard title={title}>
      <div style={{ height: CHART_HEIGHT_MD }} aria-hidden />
    </ChartCard>
  );
}
export interface BriefingVizPanelProps {
  sessions: TimerSession[];
  todoNodes: TodoNode[];
  title: string;
  streakLabels: StreakDisplayLabels;
  trendLabels: TodoCompletionTrendLabels;
  balanceLabels: WorkBreakBalanceLabels;
}
export function BriefingVizPanel({
  sessions,
  todoNodes,
  title,
  streakLabels,
  trendLabels,
  balanceLabels,
}: BriefingVizPanelProps): React.JSX.Element {
  return (
    <section className="mt-4 flex flex-col gap-3 border-t border-lumen-border pt-4">
      <h3 className="text-sm font-semibold text-lumen-text">{title}</h3>
      <div className="flex flex-col gap-3">
        <StreakDisplay sessions={sessions} labels={streakLabels} />
        <Suspense
          fallback={
            <>
              <ChartPlaceholder title={trendLabels.title} />
              <ChartPlaceholder title={balanceLabels.title} />
            </>
          }
        >
          <TodoCompletionTrend
            nodes={todoNodes}
            days={7}
            labels={trendLabels}
          />
          <WorkBreakBalance
            sessions={sessions}
            days={7}
            labels={balanceLabels}
          />
        </Suspense>
      </div>
    </section>
  );
}
```

### shared/src/components/TodoStatusCheckbox.tsx（丸いチェック・コメントを除いた形）

```tsx
import type { TodoStatus } from "../types/todoTree";
import { cn } from "./cn";
import { FOCUS_RING_TIGHT } from "./styleTokens";
import {
  STATUS_ICON,
  statusLabel,
  type StatusLabelSet,
} from "./todoStatusVisuals";
export const TODO_CHECKBOX_ICON_PX = 20;
export interface TodoStatusCheckboxProps {
  status: TodoStatus;
  onChange: (next: TodoStatus) => void;
  labels: StatusLabelSet;
  label: string;
  itemName?: string;
  accentClassName?: string;
  className?: string;
}
export function toggledTodoStatus(status: TodoStatus): TodoStatus {
  return status === "DONE" ? "NOT_STARTED" : "DONE";
}
export function TodoStatusCheckbox({
  status,
  onChange,
  labels,
  label,
  itemName,
  accentClassName = "text-lumen-accent",
  className,
}: TodoStatusCheckboxProps) {
  const Icon = STATUS_ICON[status];
  const done = status === "DONE";
  const statusText = statusLabel(status, labels);
  const name =
    itemName === undefined
      ? `${label}: ${statusText}`
      : `${itemName} — ${label}: ${statusText}`;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      onClick={() => onChange(toggledTodoStatus(status))}
      aria-label={name}
      title={statusText}
      className={cn(
        "flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lumen-md transition-colors",
        FOCUS_RING_TIGHT,
        done ? accentClassName : "text-lumen-text-secondary",
        className,
      )}
    >
      <Icon size={TODO_CHECKBOX_ICON_PX} aria-hidden className="shrink-0" />
    </button>
  );
}
```

### shared/src/components/todoStatusVisuals.ts（チェックのアイコン・コメントを除いた形）

```ts
import { Circle, CheckCircle2, type LucideIcon } from "lucide-react";
import type { TodoStatus } from "../types/todoTree";
import type { TranslationKey } from "../i18n/resources";
export const STATUS_ORDER: readonly TodoStatus[] = ["NOT_STARTED", "DONE"];
export const STATUS_ICON: Record<TodoStatus, LucideIcon> = {
  NOT_STARTED: Circle,
  DONE: CheckCircle2,
};
export const STATUS_TEXT_KEY: Record<TodoStatus, TranslationKey> = {
  NOT_STARTED: "todoDetail.statusNotStarted",
  DONE: "todoDetail.statusDone",
};
export interface StatusLabelSet {
  statusNotStarted: string;
  statusDone: string;
}
export function statusLabel(
  status: TodoStatus,
  labels: StatusLabelSet,
): string {
  switch (status) {
    case "NOT_STARTED":
      return labels.statusNotStarted;
    case "DONE":
      return labels.statusDone;
  }
}
```

### shared/src/components/schedule/TodayTodoTray.tsx（詳細パネルの「今日の Todo」・コメントを除いた形）

```tsx
import type { ReactNode } from "react";
import { CalendarMinus, Plus, Trash2 } from "lucide-react";
import type { TodoStatus } from "../../types/todoTree";
import { cn } from "../cn";
import { TodoStatusCheckbox } from "../TodoStatusCheckbox";
import type { StatusLabelSet } from "../todoStatusVisuals";
import { setTodoDragData } from "./todoCalendarDrag";
export interface TodayTodoRow {
  id: string;
  title: string;
  timeLabel?: string;
  completed: boolean;
  status?: TodoStatus;
}
export interface TodayTodoAddableRow {
  id: string;
  title: string;
  meta?: string;
}
export interface TodayTodoTrayLabels {
  placedHeading: string;
  emptyPlaced: string;
  unplacedHeading?: string;
  emptyUnplaced?: string;
  allDay?: string;
  addHeading: string;
  addAction: string;
  openAddable?: string;
  emptyAddable: string;
  openInTodos: string;
  delete?: string;
  moveOut?: string;
  status: string;
  statusLabels: StatusLabelSet;
}
export interface TodayTodoTrayProps {
  placed: TodayTodoRow[];
  unplaced: TodayTodoRow[];
  addable: TodayTodoAddableRow[];
  onToggleComplete: (id: string) => void;
  onSetStatus?: (id: string, status: TodoStatus) => void;
  onOpenTodo: (id: string) => void;
  onAddCandidate: (id: string) => void;
  onOpenAddable?: (id: string) => void;
  onDelete?: (id: string) => void;
  onMoveOut?: (id: string) => void;
  hoverActions?: boolean;
  addableControls?: boolean;
  draggableAddable?: boolean;
  renderRowExtra?: (row: TodayTodoRow) => ReactNode;
  headingActions?: { placed?: ReactNode; addable?: ReactNode };
  hideToday?: boolean;
  hideOther?: boolean;
  singleList?: boolean;
  labels: TodayTodoTrayLabels;
  className?: string;
}
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent focus-visible:ring-inset";
const HOVER_REVEAL =
  "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100";
const NARROW_TAP_FLOOR = "max-md:min-h-11 max-md:min-w-11";
function TodoRow({
  row,
  onToggleComplete,
  onSetStatus,
  onOpenTodo,
  onDelete,
  onMoveOut,
  hoverActions,
  extra,
  openLabel,
  deleteLabel,
  moveOutLabel,
  statusLabel,
  statusLabels,
  allDayLabel,
}: {
  row: TodayTodoRow;
  onToggleComplete: (id: string) => void;
  onSetStatus?: (id: string, status: TodoStatus) => void;
  onOpenTodo: (id: string) => void;
  onDelete?: (id: string) => void;
  onMoveOut?: (id: string) => void;
  hoverActions?: boolean;
  extra?: ReactNode;
  openLabel: string;
  deleteLabel?: string;
  moveOutLabel?: string;
  statusLabel: string;
  statusLabels: StatusLabelSet;
  allDayLabel?: string;
}) {
  const status: TodoStatus =
    (onSetStatus ? row.status : undefined) ??
    (row.completed ? "DONE" : "NOT_STARTED");
  const done = status === "DONE";
  return (
    <li className="group flex flex-col border-b border-lumen-border">
      <div className="flex items-center gap-2">
        <TodoStatusCheckbox
          status={status}
          onChange={(next) =>
            onSetStatus ? onSetStatus(row.id, next) : onToggleComplete(row.id)
          }
          labels={statusLabels}
          label={statusLabel}
        />
        <button
          type="button"
          onClick={() => onOpenTodo(row.id)}
          title={openLabel}
          className={cn(
            "flex min-h-[38px] min-w-0 flex-1 items-center gap-2 rounded-sm py-1 text-left",
            FOCUS,
          )}
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm",
              done
                ? "text-lumen-text-secondary line-through"
                : "text-lumen-text",
            )}
          >
            {row.title}
          </span>
          {row.timeLabel ? (
            <span className="shrink-0 text-xs tabular-nums text-lumen-text-secondary">
              {row.timeLabel}
            </span>
          ) : (
            allDayLabel && (
              <span className="shrink-0 rounded border border-lumen-chip-task-dot bg-lumen-chip-task-bg px-1.5 py-0.5 text-xs font-semibold text-lumen-chip-task-fg">
                {allDayLabel}
              </span>
            )
          )}
        </button>
        {onMoveOut && moveOutLabel && (
          <button
            type="button"
            aria-label={moveOutLabel}
            title={moveOutLabel}
            onClick={() => onMoveOut(row.id)}
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-lumen-md text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text",
              NARROW_TAP_FLOOR,
              hoverActions && HOVER_REVEAL,
              FOCUS,
            )}
          >
            <CalendarMinus aria-hidden className="size-3.5" />
          </button>
        )}
        {onDelete && deleteLabel && (
          <button
            type="button"
            aria-label={deleteLabel}
            title={deleteLabel}
            onClick={() => onDelete(row.id)}
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-lumen-md text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-danger",
              NARROW_TAP_FLOOR,
              FOCUS,
            )}
          >
            <Trash2 aria-hidden className="size-3.5" />
          </button>
        )}
      </div>
      {extra && <div className="pl-13 pb-1.5">{extra}</div>}
    </li>
  );
}
function Group({
  heading,
  headingAction,
  rows,
  empty,
  onToggleComplete,
  onSetStatus,
  onOpenTodo,
  onDelete,
  onMoveOut,
  hoverActions,
  renderRowExtra,
  openLabel,
  deleteLabel,
  moveOutLabel,
  statusLabel,
  statusLabels,
  allDayLabel,
}: {
  heading: string;
  headingAction?: ReactNode;
  rows: TodayTodoRow[];
  empty: string;
  onToggleComplete: (id: string) => void;
  onSetStatus?: (id: string, status: TodoStatus) => void;
  onOpenTodo: (id: string) => void;
  onDelete?: (id: string) => void;
  onMoveOut?: (id: string) => void;
  hoverActions?: boolean;
  renderRowExtra?: (row: TodayTodoRow) => ReactNode;
  openLabel: string;
  deleteLabel?: string;
  moveOutLabel?: string;
  statusLabel: string;
  statusLabels: StatusLabelSet;
  allDayLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-lumen-text-secondary">
          {heading}
        </h4>
        {headingAction}
      </div>
      {rows.length === 0 ? (
        <p className="py-2 text-center text-xs text-lumen-text-secondary">
          {empty}
        </p>
      ) : (
        <ul role="list" className="flex flex-col">
          {rows.map((row) => (
            <TodoRow
              key={row.id}
              row={row}
              onToggleComplete={onToggleComplete}
              onSetStatus={onSetStatus}
              onOpenTodo={onOpenTodo}
              onDelete={onDelete}
              onMoveOut={onMoveOut}
              hoverActions={hoverActions}
              extra={renderRowExtra?.(row)}
              openLabel={openLabel}
              deleteLabel={deleteLabel}
              moveOutLabel={moveOutLabel}
              statusLabel={statusLabel}
              statusLabels={statusLabels}
              allDayLabel={allDayLabel}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
export function TodayTodoTray({
  placed,
  unplaced,
  addable,
  onToggleComplete,
  onSetStatus,
  onOpenTodo,
  onAddCandidate,
  onOpenAddable,
  onDelete,
  onMoveOut,
  hoverActions,
  addableControls,
  draggableAddable,
  renderRowExtra,
  singleList,
  headingActions,
  hideToday,
  hideOther,
  labels,
  className,
}: TodayTodoTrayProps) {
  const shared = {
    onToggleComplete,
    onSetStatus,
    onOpenTodo,
    onDelete,
    onMoveOut,
    hoverActions,
    renderRowExtra,
    openLabel: labels.openInTodos,
    deleteLabel: labels.delete,
    moveOutLabel: labels.moveOut,
    statusLabel: labels.status,
    statusLabels: labels.statusLabels,
  };
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {!hideToday && (
        <Group
          {...shared}
          heading={labels.placedHeading}
          headingAction={headingActions?.placed}
          rows={singleList ? [...unplaced, ...placed] : placed}
          empty={labels.emptyPlaced}
          allDayLabel={singleList ? labels.allDay : undefined}
        />
      )}
      {!singleList && !hideToday && (
        <Group
          {...shared}
          heading={labels.unplacedHeading ?? ""}
          rows={unplaced}
          empty={labels.emptyUnplaced ?? ""}
        />
      )}
      {!hideOther && (
        <div className="flex flex-col gap-1.5">
          <div className="flex min-h-7 items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-lumen-text-secondary">
              {labels.addHeading}
            </h4>
            {headingActions?.addable}
          </div>
          {addable.length === 0 ? (
            <p className="py-2 text-center text-xs text-lumen-text-secondary">
              {labels.emptyAddable}
            </p>
          ) : (
            <ul role="list" className="flex flex-col">
              {addable.map((a) => (
                <li
                  key={a.id}
                  draggable={draggableAddable || undefined}
                  onDragStart={
                    draggableAddable
                      ? (e) => setTodoDragData(e.dataTransfer, a.id)
                      : undefined
                  }
                  className={cn(
                    "group flex items-center gap-2 border-b border-lumen-border",
                    draggableAddable && "cursor-grab active:cursor-grabbing",
                  )}
                >
                  {addableControls && (
                    <TodoStatusCheckbox
                      status="NOT_STARTED"
                      onChange={(next) =>
                        onSetStatus
                          ? onSetStatus(a.id, next)
                          : onToggleComplete(a.id)
                      }
                      labels={labels.statusLabels}
                      label={labels.status}
                    />
                  )}
                  {onOpenAddable ? (
                    <button
                      type="button"
                      title={labels.openAddable}
                      onClick={() => onOpenAddable(a.id)}
                      className={cn(
                        "min-w-0 flex-1 truncate py-1.5 text-left text-sm text-lumen-text transition-colors hover:text-lumen-accent",
                        FOCUS,
                      )}
                    >
                      {a.title}
                    </button>
                  ) : (
                    <span className="min-w-0 flex-1 truncate py-1.5 text-sm text-lumen-text">
                      {a.title}
                    </span>
                  )}
                  {a.meta && (
                    <span className="shrink-0 text-xs tabular-nums text-lumen-text-secondary">
                      {a.meta}
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={labels.addAction}
                    title={labels.addAction}
                    onClick={() => onAddCandidate(a.id)}
                    className={cn(
                      "group/add flex size-6 shrink-0 items-center justify-center rounded-lumen-md text-lumen-text-secondary transition-colors hover:text-lumen-text",
                      NARROW_TAP_FLOOR,
                      hoverActions && HOVER_REVEAL,
                      FOCUS,
                    )}
                  >
                    <span className="flex size-6 items-center justify-center rounded-lumen-md border border-lumen-border-strong transition-colors group-hover/add:bg-lumen-hover">
                      <Plus aria-hidden className="size-4" />
                    </span>
                  </button>
                  {addableControls && onDelete && labels.delete && (
                    <button
                      type="button"
                      aria-label={labels.delete}
                      title={labels.delete}
                      onClick={() => onDelete(a.id)}
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-lumen-md text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-danger",
                        NARROW_TAP_FLOOR,
                        FOCUS,
                      )}
                    >
                      <Trash2 aria-hidden className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
```

### web/src/briefing/BriefingScreen.tsx（517〜755 行目だけ: 詳細パネルへの差し込みと紙面の組み立て・コメントを除いた形）

```tsx
  const todoTrayPortal = (
    <RightSidebarPortal>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-lumen-text">
            {t("briefing.todo.title")}
          </h3>
          {tab === "morning" && (
            <button
              type="button"
              onClick={openCreatePanel}
              aria-label={t("briefing.addScheduleItem")}
              title={t("briefing.addScheduleItem")}
              className="-my-1 -mr-1.5 flex flex-shrink-0 items-center justify-center rounded-lumen-sm p-1.5 text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-briefing-shu focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent max-md:min-h-11 max-md:min-w-11"
            >
              <Plus size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        <TodayTodoTray
          placed={todoPlaced}
          unplaced={todoUnplaced}
          addable={todoAddable}
          singleList
          onToggleComplete={handleToggleTodo}
          onSetStatus={handleSetTodoStatus}
          onOpenTodo={() => onNavigate({ section: "schedule" })}
          onAddCandidate={handleAddTodoCandidate}
          labels={todoTrayLabels}
        />
      </div>
    </RightSidebarPortal>
  );
  const vizPortal = (
    <RightSidebarPortal>
      <BriefingVizPanel
        sessions={data.sessions}
        todoNodes={data.todoNodes}
        title={t("briefing.vizTitle")}
        streakLabels={streakLabels}
        trendLabels={trendLabels}
        balanceLabels={balanceLabels}
      />
    </RightSidebarPortal>
  );
  const createPanelOverlay = (
    <ItemDetailOverlay
      open={createOpen}
      title={t("scheduleScreen.addItem")}
      onClose={closeCreatePanel}
    >
      <ItemCreatePanel
        key={todayKey}
        initial={{ date: todayKey }}
        pools={{ todos: todoAddable, notes: noteOptions }}
        handlers={{
          onSubmitEvent: submitEvent,
          onSubmitEventAndOpen: submitEventAndOpen,
          onCreateTodo: submitTodo,
          onPlaceTodo: submitPlaceTodo,
        }}
        formatDuration={formatDuration}
        labels={createPanelLabels}
      />
    </ItemDetailOverlay>
  );
  const deleteScopeDialog = (
    <RepeatScopeDialog
      open={deleteScopeItem !== null}
      mode="delete"
      labels={{
        title: t("scheduleScreen.deleteScopeTitle"),
        thisOnly: t("scheduleScreen.scopeThisOnly"),
        thisAndFuture: t("scheduleScreen.scopeThisAndFuture"),
        all: t("scheduleScreen.scopeAll"),
        cancel: t("scheduleScreen.scopeCancel"),
        thisAndFutureNote: t("scheduleScreen.scopeDeleteFutureTagNote"),
      }}
      onChoose={handleDeleteScopeChoose}
      onClose={closeDeleteScope}
    />
  );
  if (tab === "evening") {
    return (
      <>
        {todoTrayPortal}
        <EveningView
          loading={loading || focusLoading}
          dateLine={dateLine}
          mood={eveningMood}
          onSelectMood={handleSelectMood}
          editorSlot={
            editingEvening ? (
              <LazyRichTextEditor
                key={`evening:${todayKey}:${eveningGen}`}
                noteId={`evening-${todayKey}`}
                initialContent={eveningStored.bodyDocJson ?? undefined}
                onUpdate={handleEveningUpdate}
                onDirty={markEveningDirty}
                placeholder={t("briefing.evening.placeholder")}
                className="min-h-[180px] px-4 py-3"
                autoFocus={focusOnGen === eveningGen}
              />
            ) : (
              <EveningReflectionPreview
                lines={eveningLines}
                placeholder={t("briefing.evening.placeholder")}
                editLabel={t("briefing.evening.startEditing")}
                onStartEditing={startEditingEvening}
                onPrefetch={preloadRichTextEditor}
                className="min-h-[244px] px-4 py-3"
              />
            )
          }
          intentionText={
            intentionEditableOnEvening
              ? intentionText
              : (intentionStored.text ?? "")
          }
          intentionEditable={intentionEditableOnEvening}
          onIntentionChange={handleIntentionChange}
          onIntentionBlur={flushIntention}
          focusText={focusDraft}
          onFocusChange={handleFocusChange}
          onFocusBlur={flushFocus}
          todos={remainingTodos}
          onSetTodoStatus={handleSetTodoStatus}
          schedule={upcoming}
          labels={eveningLabels}
          tabSwitcher={tabSwitcher}
        />
      </>
    );
  }
  return (
    <>
      {todoTrayPortal}
      {vizPortal}
      <BriefingView
        loading={loading || goalsLoading || focusLoading}
        data={data}
        labels={labels}
        focusText={todayFocus}
        intentionText={intentionText}
        onIntentionChange={handleIntentionChange}
        onIntentionBlur={flushIntention}
        goals={goals}
        goalLabels={goalLabels}
        onGoalChange={handleGoalChange}
        onGoalBlur={flushGoals}
        onToggleTodo={handleToggleTodo}
        onDeleteScheduleItem={handleDeleteScheduleItem}
        onDeleteTodo={handleDeleteTodo}
        onAddScheduleItem={openCreatePanel}
        onJumpToSchedule={(id) => openItem(id, "event")}
        onJumpToTodos={(id) => openItem(id, "task")}
        tabSwitcher={tabSwitcher}
      />
      {deleteScopeDialog}
      {createPanelOverlay}
    </>
  );
}
```

### shared/src/styles/tokens.css（1〜243 行目: light / dark の色の定義・コメントを除いた形）

```css
:root,
[data-theme="light"] {
  --color-bg-primary: #fbf4e8;
  --color-bg-secondary: #f5ebda;
  --color-bg-subsidebar: #f8efe1;
  --color-surface-sunken: #efe3cd;
  --color-text-primary: #2b2015;
  --color-text-secondary: #6b5a45;
  --color-text-tertiary: #756249;
  --color-border: #eadec6;
  --color-border-strong: #d6c3a2;
  --color-accent: #ad4409;
  --color-accent-hover: #8f3807;
  --color-on-accent: #ffffff;
  --color-on-vivid: #0a1024;
  --color-accent-subtle: #fbe3c6;
  --color-accent-secondary: #1fa56e;
  --color-chip-mint-bg: #daf3e7;
  --color-chip-mint-fg: #0c6f4e;
  --color-hover: #f0e5d0;
  --color-briefing-shu: #ad2f1d;
  --color-briefing-shu-subtle: #f7e0d6;
  --color-briefing-kohaku: #8a5c06;
  --color-briefing-kohaku-subtle: #f6e7c8;
  --color-success: #0f7b6c;
  --color-success-subtle: #e7e4d3;
  --color-danger: #d92d20;
  --color-danger-subtle: #f0e5e6;
  --color-info: #2563eb;
  --color-warning: #b45309;
  --color-info-subtle: #e9e3db;
  --color-warning-subtle: #f1e2cd;
  --color-schedule-routine-bg: #ebf0fe;
  --color-schedule-event-bg: #f3e8ff;
  --color-schedule-event-border: #8b5cf6;
  --color-schedule-task-bg: #dbeafe;
  --color-chip-routine-bg: #ebf0fe;
  --color-chip-routine-fg: #3b5bdb;
  --color-chip-routine-dot: #5b6cdb;
  --color-chip-event-bg: #f3e8ff;
  --color-chip-event-fg: #6d28d9;
  --color-chip-event-dot: #8b5cf6;
  --color-chip-task-bg: #dbeafe;
  --color-chip-task-fg: #1e40af;
  --color-chip-task-dot: #1d4ed8;
  --color-chip-progress-bg: #fef6e0;
  --color-chip-progress-fg: #a06b09;
  --color-status-done-band: #10b981;
  --color-chart-stagnation-1: #22c55e; /* < 1 week */
  --color-chart-stagnation-2: #84cc16; /* 1-2 weeks */
  --color-chart-stagnation-3: #eab308; /* 2-4 weeks */
  --color-chart-stagnation-4: #f97316; /* 1-3 months */
  --color-chart-stagnation-5: #ef4444; /* 3+ months */
  --color-chart-phase-long-break: #f59e0b; /* WORK/BREAK reuse accent/success */
  --color-chart-cat-1: #2563eb;
  --color-chart-cat-2: #22c55e;
  --color-chart-cat-3: #f59e0b;
  --color-chart-cat-4: #ef4444;
  --color-chart-cat-5: #8b5cf6;
  --color-chart-cat-6: #ec4899;
  --color-chart-cat-7: #06b6d4;
  --color-chart-cat-8: #84cc16;
  --color-chart-cat-9: #f97316;
  --color-chart-cat-10: #6366f1;
  --shadow-elevation-sm: 0 1px 2px 0 rgb(15 23 42 / 0.06);
  --shadow-elevation-md:
    0 2px 8px -1px rgb(15 23 42 / 0.1), 0 1px 3px -1px rgb(15 23 42 / 0.06);
  --shadow-elevation-lg:
    0 14px 34px -10px rgb(15 23 42 / 0.2), 0 4px 10px -4px rgb(15 23 42 / 0.1);
}
[data-theme="dark"] {
  --color-bg-primary: #101a2c;
  --color-bg-secondary: #18243c;
  --color-bg-subsidebar: #18243c;
  --color-surface-sunken: #0a1220;
  --color-text-primary: #edf1f9;
  --color-text-secondary: #a4b2ca;
  --color-text-tertiary: #8e9aaf;
  --color-border: #263650;
  --color-border-strong: #3c4e70;
  --color-accent: #85aaff;
  --color-accent-hover: #a3c0ff;
  --color-on-accent: #0a1024;
  --color-accent-subtle: #1e2d4b;
  --color-accent-secondary: #5fd1a0;
  --color-chip-mint-bg: #133024;
  --color-chip-mint-fg: #7fe0b3;
  --color-hover: #22314e;
  --color-briefing-shu: #f0907c;
  --color-briefing-shu-subtle: #35201f;
  --color-briefing-kohaku: #dcb267;
  --color-briefing-kohaku-subtle: #2e2513;
  --color-success: #4dab9a;
  --color-success-subtle: #1c2f44;
  --color-danger: #ef4444;
  --color-danger-subtle: #2f2126;
  --color-info: #60a5fa;
  --color-warning: #fbbf24;
  --color-info-subtle: #1e2e4b;
  --color-warning-subtle: #2a303a;
  --color-schedule-routine-bg: #1e293b;
  --color-schedule-event-bg: #2e1065;
  --color-schedule-event-border: #a78bfa;
  --color-schedule-task-bg: #1d2348;
  --color-chip-routine-bg: #1e2a48;
  --color-chip-routine-fg: #93c5fd;
  --color-chip-routine-dot: #818cf8;
  --color-chip-event-bg: #2e1065;
  --color-chip-event-fg: #c4b5fd;
  --color-chip-event-dot: #a78bfa;
  --color-chip-task-bg: #1d2348;
  --color-chip-task-fg: #aebcff;
  --color-chip-task-dot: #5b8cff;
  --color-chip-progress-bg: #3a2e0a;
  --color-chip-progress-fg: #fcd34d;
  --color-status-done-band: #10b981;
  --shadow-elevation-sm: 0 1px 2px 0 rgb(0 0 0 / 0.45);
  --shadow-elevation-md:
    0 4px 12px -2px rgb(0 0 0 / 0.55), 0 2px 6px -2px rgb(0 0 0 / 0.4);
  --shadow-elevation-lg:
    0 18px 44px -10px rgb(0 0 0 / 0.7), 0 6px 16px -6px rgb(0 0 0 / 0.5);
}
```

### shared/src/styles/tokens.css（319〜512 行目: Tailwind のトークン名・角丸・余白・幅・文字・コメントを除いた形）

```css
[data-theme] {
  --color-lumen-bg: var(--color-bg-primary);
  --color-lumen-bg-subsidebar: var(--color-bg-subsidebar);
  --color-lumen-surface-sunken: var(--color-surface-sunken);
  --color-lumen-border: var(--color-border);
  --color-lumen-accent: var(--color-accent);
  --color-lumen-accent-subtle: var(--color-accent-subtle);
}
@theme {
  --color-lumen-bg: var(--color-bg-primary);
  --color-lumen-bg-secondary: var(--color-bg-secondary);
  --color-lumen-bg-subsidebar: var(--color-bg-subsidebar);
  --color-lumen-text: var(--color-text-primary);
  --color-lumen-text-secondary: var(--color-text-secondary);
  --color-lumen-border: var(--color-border);
  --color-lumen-border-strong: var(--color-border-strong);
  --color-lumen-accent: var(--color-accent);
  --color-lumen-accent-hover: var(--color-accent-hover);
  --color-lumen-on-accent: var(--color-on-accent);
  --color-lumen-accent-subtle: var(--color-accent-subtle);
  --color-lumen-accent-secondary: var(--color-accent-secondary);
  --color-lumen-chip-mint-bg: var(--color-chip-mint-bg);
  --color-lumen-chip-mint-fg: var(--color-chip-mint-fg);
  --color-lumen-hover: var(--color-hover);
  --color-lumen-success: var(--color-success);
  --color-lumen-success-subtle: var(--color-success-subtle);
  --color-lumen-danger: var(--color-danger);
  --color-lumen-danger-subtle: var(--color-danger-subtle);
  --color-lumen-info: var(--color-info);
  --color-lumen-warning: var(--color-warning);
  --color-lumen-info-subtle: var(--color-info-subtle);
  --color-lumen-warning-subtle: var(--color-warning-subtle);
  --color-lumen-surface-sunken: var(--color-surface-sunken);
  --color-lumen-text-tertiary: var(--color-text-tertiary);
  --color-lumen-briefing-shu: var(--color-briefing-shu);
  --color-lumen-briefing-shu-subtle: var(--color-briefing-shu-subtle);
  --color-lumen-briefing-kohaku: var(--color-briefing-kohaku);
  --color-lumen-briefing-kohaku-subtle: var(--color-briefing-kohaku-subtle);
  --color-lumen-chip-task-bg: var(--color-chip-task-bg);
  --color-lumen-chip-task-fg: var(--color-chip-task-fg);
  --color-lumen-chip-task-dot: var(--color-chip-task-dot);
  --color-lumen-chip-progress-bg: var(--color-chip-progress-bg);
  --color-lumen-chip-progress-fg: var(--color-chip-progress-fg);
  --color-lumen-phase-long-break: var(--color-chart-phase-long-break);
  --color-lumen-on-vivid: var(--color-on-vivid);
  --color-lumen-status-done-band: var(--color-status-done-band);
  --color-lumen-schedule-routine-bg: var(--color-schedule-routine-bg);
  --color-lumen-schedule-event-bg: var(--color-schedule-event-bg);
  --color-lumen-schedule-event-border: var(--color-schedule-event-border);
  --color-lumen-schedule-task-bg: var(--color-schedule-task-bg);
  --color-lumen-chip-routine-bg: var(--color-chip-routine-bg);
  --color-lumen-chip-routine-fg: var(--color-chip-routine-fg);
  --color-lumen-chip-routine-dot: var(--color-chip-routine-dot);
  --color-lumen-chip-event-bg: var(--color-chip-event-bg);
  --color-lumen-chip-event-fg: var(--color-chip-event-fg);
  --color-lumen-chip-event-dot: var(--color-chip-event-dot);
  --shadow-lumen-sm: var(--shadow-elevation-sm);
  --shadow-lumen-md: var(--shadow-elevation-md);
  --shadow-lumen-lg: var(--shadow-elevation-lg);
  --radius-lumen-sm: 6px;
  --radius-lumen-md: 8px;
  --radius-lumen-lg: 12px;
  --radius-lumen-full: 9999px;
  --spacing-lumen-2: 8px;
  --spacing-lumen-3: 12px;
  --container-lumen-reading: 818px;
  --container-lumen-data: 1050px;
  --container-lumen-wide: 1170px;
  --spacing-lumen-gutter: 16px;
  --spacing-lumen-gutter-wide: 24px;
  --spacing-lumen-header: 3.5rem;
  --spacing-lumen-header-wide: 3.75rem;
  --spacing-lumen-titlebar-mac: 28px;
  --spacing-lumen-icon-min: 0.9rem;
  --spacing-lumen-tap-min: 1.75rem;
  --text-xs: 0.8125rem;
  --font-sans:
    ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica,
    "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol";
  --font-serif: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
  --font-mono:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
}
```

### shared/src/styles/tokens.css（514〜748 行目: アイコンと押せる面の最小サイズ・Mobile の入力欄の文字・入場の動き・動きを減らす設定・コメントを除いた形）

```css
@layer components {
  svg.lucide {
    min-width: var(--spacing-lumen-icon-min);
    min-height: var(--spacing-lumen-icon-min);
  }
  button:has(> svg.lucide:only-child),
  a:has(> svg.lucide:only-child) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: var(--spacing-lumen-tap-min);
    min-height: var(--spacing-lumen-tap-min);
  }
}
:root {
  --field-font-size-min: 16px;
}
@media (max-width: 767px) {
  input:not([type="range"]):not([type="color"]):not([type="checkbox"]):not(
      [type="radio"]
    ):not([type="file"]),
  textarea,
  select,
  [contenteditable="true"] {
    font-size: max(var(--field-font-size-min), var(--field-font-size, 1em));
  }
}
@keyframes lumen-drawer-in-left {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}
@keyframes lumen-scrim-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes lumen-panel-in-right {
  from {
    margin-right: calc(-1 * var(--lumen-panel-w, 0px));
  }
  to {
    margin-right: 0;
  }
}
.lumen-drawer-in-left {
  animation: lumen-drawer-in-left 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}
.lumen-scrim-in {
  animation: lumen-scrim-in 0.2s ease-out;
}
.lumen-panel-in-right {
  animation: lumen-panel-in-right 0.2s ease-out;
}
@keyframes lumen-section-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.lumen-section-in {
  animation: lumen-section-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@media (prefers-reduced-motion: reduce) {
  :root:not([data-reduce-motion="off"]) *,
  :root:not([data-reduce-motion="off"]) *::before,
  :root:not([data-reduce-motion="off"]) *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
:root[data-reduce-motion="reduce"] *,
:root[data-reduce-motion="reduce"] *::before,
:root[data-reduce-motion="reduce"] *::after {
  animation-duration: 0.001ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.001ms !important;
}
```
````

## 4. 更新のしかた

- **設計が変わったら**、§1 と §3 の枠の「10. 決まった方向」を同じ内容に書き換えます。見本データ（枠の「11.」）も新しい設計に合わせます。
- **§1.7 のまだ決めていないことが決まったら**、§1.7 と枠の「10.6」から外し、決まった形を §1.3〜§1.5 と枠の「10.2〜10.4」に書き足します。
- **スクリーンショットが届いたら**、貼り付けと同じメッセージに画像を添付します。枠の「0. お願いしたいこと」の末尾にある「まだ添付していません」の文を、添付した画面の一覧に書き換えます。
- **紙面のコードが変わったら**、枠の付録を貼り直します。付録はファイルを写したものなので、手で直さずに元のファイルからコピーし直します。あわせて §2 の行番号と、枠の 3〜5 節の文言を確かめます。
- **Claude Design で生成したら**、frontmatter の Status を Generated に変え、生成したプロジェクトの場所をこの節の下に書き足します。
