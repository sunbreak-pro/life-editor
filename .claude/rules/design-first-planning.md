# 画面が変わる計画は、デザインシステムと Artifact で UI / UX を確かめてから書く

> 2026-10-28 こうだいさんの決定（[`D-20261028-main-1`](../decisions/D-20261028-main-1.md)・#2372）。計画書に書く欄は [`_TEMPLATE.md`](../docs/vision/plans/_TEMPLATE.md) の「UI / UX の確認」節。

新しい機能と、見た目や操作の流れが変わる改修は、実装に入る前に画面の案を Artifact で作り、こうだいさんが確かめてから計画書を確定します。文字だけの計画書では、出来上がった画面が思っていたものと違うと実装のあとで分かり、作り直しになるためです。

## 対象

- **対象**: 新しい機能、画面・パネル・部品の追加、見た目や操作の流れが変わる改修。
- **対象外**: 見た目の変わらないバグ修正、リファクタ、docs、MCP の道具のように画面を持たない変更、1 画面の数 px のずれを直すだけの修正。

## 使うもの

- **デザインシステム**: Artifact の「Life Editor」（https://claude.ai/artifact/KPdEWuLhoeL9MdzRRa43Aa）。色・文字・余白・部品・文言の決まりはここに従います。値の正本はコードの `shared/src/styles/tokens.css` なので、食い違ったらコードを優先し、ずれを報告に書きます。
- **試作の出発点**: Claude Design の試作プロジェクト `Life Editor.dc.html`（https://claude.ai/design/p/90a82a78-0ef6-419a-80dd-0739acaa9df9?file=Life+Editor.dc.html&via=share）。今の画面の外枠と操作がここにあります。Artifact ツールでは読めないので、中身を見るときは Chrome（claude-in-chrome）で開きます。単独の Claude Design は 2026-12-14 に Artifact へ移るので、移ったあとは移行先の Artifact の URL に読み替えます。

## 手順

1. **デザインシステムを読む**: `Artifact` ツールの `read` で上の URL を読みます。部品の説明は `project/README.md` と `project/components/*/README.md` にあります。
2. **案を Artifact で作る**: Artifact の Design 型で、デザインシステムに「Life Editor」を指定して画面の案を作ります。次の 3 つは必ず入れます。
   - Desktop と Mobile（768px 未満）の両方の画面。
   - 4 つの状態（読み込み中・空・エラー・通常）と、操作の途中の画面（追加・編集中・ドラッグ中など）。
   - 案が割れるときは 2〜3 案。違いを 1 行ずつ添えます。

   押すと何が出るかを動きで見せたいときは、`html-report` スキルの切り替え式モックアップで HTML の Artifact を足してかまいません。色と部品はデザインシステムに合わせます。

3. **こうだいさんに確かめてもらう**（👀 の Gate）: Artifact の URL を渡し、どの案にするかと直すところを聞きます。返事を受けたら Artifact を直して同じ URL に出し直します。返事を待つあいだは、計画書の画面に関わらない部分か、別の作業を進めます。
4. **計画書を書く**: 採った案の URL・こうだいさんの返事を「UI / UX の確認」節に書き、採らなかった案を「検討した代替案」の表に書きます。Scope と Steps は採った案をもとに決めます。
5. **実装する**: 計画書が確定してから実装に入ります。実装中に案と違う画面にしたくなったら、自分で決めずに P-008 に従って判断キューへ出します。

## 補足

- 実装した画面は、merge のあとに chat-main が実ブラウザで撮り、採った案と比べます（`design-critique` スキル）。dev server と実ブラウザは chat-main だけが使います（CLAUDE.md §7.4）。worktree のチャットも Artifact は作ってかまいません。
- 値をコードへ戻すときの読み替え（px と Tailwind・`lumen-*` の対応）は [`docs/design/README.md`](../docs/design/README.md) の「調整した案を実装へ戻す手順」に従います。
