# docs/design — ClaudeDesign 用デザイン brief 置き場

ClaudeDesign (claude.ai/design) に貼るプロンプトの**正本**と、その根拠（要件・現状 UI・デザイン方針）をまとめるディレクトリ。

## 構成

| ファイル                    | 役割                                                                                                                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IA.md`                     | **ナビ構成の正本**（サイドバー = 本流 + ユーティリティ枠 / header タブ / Mobile 固定 4 + More。2026-07-05 ユーザー承認。**個数と並びは `shared/src/sections.ts` の registry を数える** — 数値の非複製原則） |
| `briefs/_TEMPLATE.md`       | brief の統一形式（全セッション必ず準拠）                                                                                                                                                                    |
| `briefs/_COMMON-CONTEXT.md` | **引退済み**（#2152）。旧・全プロンプト共通の前提ブロック。後継は部品集の 2 枚で、新しく作る brief からは参照しない（下の運用原則）                                                                         |
| `briefs/<section>.md`       | 各画面の brief（**1 セッション = 1 ファイル = 単一書込者**）                                                                                                                                                |

## 運用原則

- **ClaudeDesign はリポジトリを読めない**。プロンプト本文は自己完結させる（パス参照・「上記参照」禁止）
- 生成 → 同期 → 移植の分業: 生成 = claude.ai/design 側 / Claude Code 側 DesignSync は同期専用 / 出荷 UI 化は `shared/src/components/` への移植（別計画）
- トークンの SSOT は `shared/src/styles/tokens.css`、ナビ構成の SSOT は `IA.md`。
- **アプリの説明と設計の意図はプロンプトに埋め込まない**（#2152）。部品集の `shared/design-system/claude-design/foundations/app.html`（アプリの説明）と `intent.html`（設計の意図）が DesignSystem プロジェクト経由で毎回読み込まれるため、旧 `_COMMON-CONTEXT.md` の役目はこの 2 枚が引き継いだ。部品集と tokens.css・`sections.ts` のずれは `shared/tests/designKitFreshness.test.ts` が見つける
- **全 brief は現行実装ではなく `IA.md` の目標構成に向けてデザインする**

計画書（COMPLETED・2026-08-01 に archive へ移動）: [`../../archive/2026-07-04-claudedesign-screen-design-fanout.md`](../../archive/2026-07-04-claudedesign-screen-design-fanout.md)

デザイン追跡の実務は Epic #321 + [`../requirements/mobile-scope.md`](../requirements/mobile-scope.md) + Issue 群が引き継いでいる。

## 調整した案を実装へ戻す手順（#2154）

Claude Design の上で余白や文字の大きさを微調整したあと、その値をコードへ戻すための手順です。引っ越しでいうと、新居で決めた家具の配置図を、実際に家具を運ぶ人が読める指示書に書き直す段階にあたります。値は Claude Design では px、コードでは Tailwind のクラスか `lumen-*` のトークンなので、その読み替えの表と、持ち帰り方を決めておきます。

### 前提: ルートの文字サイズと 2 種類の単位

- ルートの文字サイズは、設定画面の 10 段（12〜25px）で変わります。既定は 18px です（`shared/src/constants/fontSize.ts`）。
- コードの寸法は 2 種類あります。Tailwind の数値のクラス（`p-3` など）は rem で、文字サイズの設定に合わせて伸び縮みします。`lumen-*` の余白・角丸・溝のトークンは px で、伸び縮みしません。
- Claude Design の試作もルート 18px で組んでいる前提で、px の値を受け取ります。18px 以外で調整した値は、18px に換算してから表に当てます。

### 値の対応表

| 種類                         | Claude Design の値（ルート 18px）       | コードの書き方                                                           | 読み替え方                                                                          |
| ---------------------------- | --------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| 画面の中の余白・間・幅・高さ | 4.5 の倍数（4.5 / 9 / 13.5 / 18 / 27…） | Tailwind の数値（`p-1` / `p-2` / `p-3` / `p-4` / `p-6`…）                | px ÷ 4.5 がクラスの数字。今のコードの大半はこちらで書かれている                     |
| 部品の段の余白               | 4 / 8 / 12 / 16 / 24                    | `p-lumen-1` / `-2` / `-3` / `-4` / `-6`                                  | そのまま。20px は意図して欠番（`tokens.css` の `--spacing-lumen-*`）                |
| 画面の左右の溝               | 16（Mobile）/ 24（Desktop）             | `px-lumen-gutter md:px-lumen-gutter-wide`                                | そのまま                                                                            |
| 文字の大きさ                 | 14.625 / 15.75 / 18 / 20.25 / 22.5 / 27 | `text-xs` / `text-sm` / `text-base` / `text-lg` / `text-xl` / `text-2xl` | 下の「文字の大きさの段」                                                            |
| 文字の太さ                   | 400 / 500 / 600 / 700                   | `font-normal` / `font-medium` / `font-semibold` / `font-bold`            | そのまま                                                                            |
| アイコンの大きさ             | 16.2 / 20.25 / 24.75                    | `size-lumen-icon-sm` / `-md` / `-lg`                                     | 16.2 より小さい値は描けない（下限が 0.9rem）                                        |
| 角丸                         | 6 / 8 / 12 / 完全な円                   | `rounded-lumen-sm` / `-md` / `-lg` / `-full`                             | そのまま                                                                            |
| 動きの長さ                   | 150 / 250 / 400ms                       | `duration-(--duration-lumen-fast)` / `-normal` / `-slow`                 | そのまま                                                                            |
| 色                           | hex                                     | `lumen-*` の色のトークン                                                 | tokens.css にある値だけを使う。無い hex は近いトークンに寄せて、PR 本文に並べて書く |

**どちらの書き方を使うか**: その場所の今の書き方に合わせます。`p-3`（13.5px）で書かれた場所を 12px に詰めるなら `p-lumen-3` ではなく、段の近い Tailwind の数値（`p-2.5` = 11.25px か `p-3`）に寄せます。1 か所の中で 2 種類を混ぜると、文字サイズの設定を変えたときに、その場所だけ比率が崩れるためです。微調整のプロンプト（`prototype/11-prompts-follow-up.md` の C）は余白を 4 / 8 / 12 / 16 / 24px から選ばせているので、Tailwind の数値で書かれた場所に返ってきた値は、近い 4.5 の倍数に寄せて読みます。

**段から外れた値の扱い**: 近い段に寄せます。寄せた差が 1px を超えるときは、元の値と寄せた値を PR 本文に並べます。Claude Design が「段の追加の提案」として返した値と、寄せると見た目が崩れる値だけは、段を足すかどうかを判断キュー（`.claude/comm/decisions/`）に出します。足すかどうかを実装の途中で自分で決めません。

### 文字の大きさの段

**Tailwind の `text-*` をそのまま文字の段として扱います。画面用の文字トークンは足しません。** 理由は次のとおりです。

- 名前の付いた段（`text-xs`〜`text-2xl`）が `shared/src` と `web/src` の `.tsx` で 744 か所使われていて、すでに段として働いています（2026-10-11 に `grep -rhoE --include=*.tsx` で数えた値）。
- トークンを足しても、744 か所を置き換えるまで効き目がありません。今の段を文書にするほうが、同じ効き目を早く得られます。
- xs だけは `tokens.css` の `--text-xs: 0.8125rem` で上げてあり、ほかは Tailwind の既定のままです。この 1 つの上書きも、段の表に書けば足ります。

| 段          | rem                                           | ルート 18px での px | 主な使いどころ             |
| ----------- | --------------------------------------------- | ------------------- | -------------------------- |
| `text-xs`   | 0.8125（Tailwind の既定 0.75 から上げてある） | 14.625              | 一覧の補足・ラベル・チップ |
| `text-sm`   | 0.875                                         | 15.75               | 本文・一覧の題             |
| `text-base` | 1                                             | 18                  | 入力欄・読み物の本文       |
| `text-lg`   | 1.125                                         | 20.25               | 小見出し                   |
| `text-xl`   | 1.25                                          | 22.5                | 見出し                     |
| `text-2xl`  | 1.5                                           | 27                  | 画面の大見出し・大きな数字 |

`text-3xl` 以上は今のコードで使っていません。部品集の `shared/design-system/claude-design/foundations/typography.html` にも同じ段を載せています。

**`text-[…]` の直書き（38 か所）は、段に寄せます。** 置き換えは別の Issue で、1 画面ずつ測ってから進めます。直書きは、単位によって扱いを分けます。

- **px の直書き**（`text-[12.5px]` ×8・`text-[13px]` ×5・`text-[28px]` ×3 など）: 文字サイズの設定に追従しません。設定を大きくしても、この文字だけ大きくならないので、段に寄せます。
- **xs より小さい rem**（`text-[0.625rem]` ×6・`text-[0.6875rem]` ×5・`text-[0.75rem]` ×4）: 月のマスのチップや件数のバッジのように、xs では入らない密な場所で使っています。設定には追従するので、段の外の例外として残すか、段に `2xs` を足すかを、その Issue で判断キューに出します。
- 新しく書くコードでは `text-[…]` を使わず、上の段から選びます。

### 持ち帰り方

経路は、上から順に使えるものを選びます。

1. **試作パネルの「値を書き出す」の JSON を貼る**（いちばん手軽）: 試作一式（`prototype/`）の試作パネルが出す JSON を、Claude Code のチャットに貼ります。形は下の「書き出す JSON の形」に揃えます。試作パネルの初期のプロンプトは形を決めていないので、微調整を頼むプロンプト（`prototype/11-prompts-follow-up.md` の C）に「書き出しはこの形で」と添えます。
2. **standalone HTML か Project archive で書き出す**（値を測って確かめたいとき）: Claude Design のプロジェクトの書き出し（Share → Project HTML、または Export）で HTML を取り出し、メインのクローンの `shots/` の下に置きます。git には入れません。chat-main がブラウザで開いて `measure.js` を当て、px の値を取ります。
3. **Claude Code への引き渡し（Hand off to Claude Code）**: Claude Design の書き出しの中に、ローカルの Claude Code へ送る経路があります。中身の形（何が束ねられるか）は未確認なので、使うときは最初に中身を確かめ、2 と同じく測ってから値を取ります。
4. **こうだいさんが値をメモして渡す**: 1〜3 が使えないときです。「場所・項目・今の値・変えた値」の 4 つを書いてもらいます。

**Claude Design の画面で直接いじった値**: Claude Design のキャンバスでは、部品を直接ドラッグ・大きさ変更・整列できます。Claude が作るスライダー（つまみ）で余白や色を動かすこともできます（2026-10-11 に [Anthropic のヘルプ](https://support.claude.com/en/articles/14604416-get-started-with-claude-design)と[告知](https://www.anthropic.com/news/claude-design-anthropic-labs)で確認。スライダーは告知だけに載っている）。どちらも試作パネルの JSON には自動では入りません。直接いじったあとは、チャットで「いま変えた値を、書き出す JSON の形で返して」と頼むか、2 の経路で測ります。

**7 月の `claude_design` MCP の経路**（`.claude/archive/2026-07-05-design-implementation-fanout.md`）は、デザインのファイル一式（`.dc.html`）を取り込むものでした。値を持ち帰る専用の手段はなく、実装したセッションがデザインを読んで書き直していました。今は 2 か 3 の経路で同じことができるので、新しくは使いません。

**Claude Design の移行**: 単独の Claude Design（claude.ai/design）は 2026-12-14 に閉じ、Claude の中の Artifact に移ります（Anthropic のヘルプ「[Migrate from standalone Claude Design to Claude](https://support.claude.com/en/articles/17440474-migrate-from-standalone-claude-design-to-claude)」）。移ったあとのデザインを Claude Code の Artifact ツールで直接読めるかは未確認です。読めると分かったら、2 の経路の書き出しを省けます。

### 書き出す JSON の形

```json
{
  "screen": "schedule",
  "frame": "desktop-1440x900",
  "rootPx": 18,
  "steps": { "text-sm": 16.5 },
  "places": [
    {
      "where": "週ビューのツールバー",
      "what": "下の余白",
      "from": 18,
      "to": 13.5
    }
  ]
}
```

- `steps` は段そのものを変えた値です（試作パネルのつまみで段を動かしたとき）。段の値を変えると、その段を使うすべての場所が変わります。コードでは `tokens.css` の変更になるので、判断キューに出してから扱います。
- `places` は 1 か所だけを変えた値です。`where` は画面の言葉で書き、`from` と `to` は px の数で書きます。
- 単位は書かず、すべて px の数にします。`rootPx` が 18 以外なら、受け取った側が 18px に換算します。

### 実装して確かめる

1. **値を読み替える**: JSON の `places` を 1 行ずつ上の対応表に当て、コードの書き方を決めます。段から外れた値と寄せた差は、PR 本文に表で書きます。
2. **実装する**: 値の変更は、その画面の Issue の PR で行います（例: Schedule のタグフィルタパネル = #2155）。1 つの PR で 1 画面にします。
3. **測り直す**: merge のあと、chat-main が `design-critique` スキルの手順 1〜2 で同じ 4 通りを撮って測ります。
4. **Claude Design の値と比べる**: `places` の行ごとに、実装の値を並べます。余白・幅・高さは 2px 以内、文字の大きさは 0.5px 以内、アイコン・角丸・色は同じ値なら合格です。外れた行は、読み替えの誤りか、寄せた結果かを PR か Issue に書きます。
