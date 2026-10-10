# ClaudeDesign mirror — Life Editor "DesignSystem"

このディレクトリは **claude.ai の design-system プロジェクト「DesignSystem」のローカルミラー**。
各 `.html` は自己完結プレビュー（先頭 `<!-- @dsCard group="..." -->` で Design System ペインのカードになる）。

- **ClaudeDesign project**: `DesignSystem`（type `PROJECT_TYPE_DESIGN_SYSTEM`）
- **projectId**: `962335c3-6d29-40b7-b0c2-0d5f54144e47`
- **owner**: こうだい（claude.ai login = fstprog@gmail.com）
- **旧 project**: `Design System`（`d0c25129-...`）に初期パイロット4枚（colors/button/card/input）。新パレットで作り直して当ディレクトリ＝新 project に移行済み。旧は archive 扱い。

## 中身

| path                          | group       | 内容                                                                             |
| ----------------------------- | ----------- | -------------------------------------------------------------------------------- |
| `foundations/colors.html`     | Foundations | 朝刊・夕刊パレット（light/dark・mint 第2アクセント・semantic・Briefing 朱/琥珀） |
| `foundations/principles.html` | Foundations | 作成原則カード（要約。正本 = `../PRINCIPLES.md`）                                |
| `components/button.html`      | Components  | 5 variants × 3 sizes（primary=accent 燈色 / mint 差し色追加）                    |
| `components/card.html`        | Components  | surface（padding sm/md/lg・selected=accent ring・mint tag）                      |
| `components/input.html`       | Components  | text input（focus ring=accent）                                                  |
| `components/chips.html`       | Components  | status chips（task/routine/event/completed/progress/mint）＋status band          |
| `components/modal.html`       | Components  | dialog（backdrop＋不透明パネル・secondary/primary フッタ）                       |
| `components/toast.html`       | Components  | toast（success/danger/info・左アクセントバー）                                   |
| `components/sheet.html`       | Components  | mobile bottom sheet（grabber・list・primary action）                             |
| `components/nav.html`         | Components  | sidebar nav 状態（default/hover/selected/mint）                                  |
| `foundations/typography.html` | Foundations | 10-step type scale＋weights＋font stack                                          |
| `foundations/steps.html`      | Foundations | 色以外の段（spacing・icon size・motion の duration / easing）                    |
| `foundations/app.html`        | Foundations | アプリの説明（何のアプリか・Desktop と Mobile の役割・全セクションと各画面の役目） |
| `foundations/intent.html`     | Foundations | 設計の意図（朝刊・夕刊の配色・不透明な背景・lumen-* トークン・UI の 4 状態・44px・段の使い分け） |

## 同期

`DesignSync` ツールで push する（`/design-sync` skill 準拠。incremental・wholesale replace しない）:

1. `list_files` / `get_file` で差分把握
2. `finalize_plan`（projectId 上記・`writes`/`deletes`・`localDir` = このディレクトリ）→ 承認
3. `write_files`（planId・各 `localPath`）

色の SSOT は `../../src/styles/tokens.css` + `../PRINCIPLES.md §3.3`。色を変えたら colors.html も追従する。色以外のトークン（spacing / icon size / motion）も同じ `tokens.css` が正本で、値を変えたら steps.html も追従する。

app.html と intent.html は、Claude Design のセッションのたびにアプリの説明と設計の意図を貼り直さずに済むように置いた 2 枚です（#2152）。旧 `.claude/docs/design/briefs/_COMMON-CONTEXT.md` の後継にあたります。セクション一覧の正本は `../../src/sections.ts`、Mobile の範囲は `.claude/docs/requirements/mobile-scope.md`、意図の正本は `../PRINCIPLES.md` と `.claude/rules/frontend.md` です。

ずれは `shared/tests/designKitFreshness.test.ts` が CI で見つけます。tokens.css の色と段が colors.html / steps.html に同じ値で載っていること、`SectionId` がすべて app.html に載っていることを確かめます。このテストが落ちたらページを直し、上の手順で DesignSystem へ送り直してください。
