# セクション切替の体感ロード — 実測と改善案（#1038）

- **日付**: 2026-08-18
- **ブランチ**: `claude/refactor-core-section-switch-1038`（base = `origin/main` @ `36eb33f1`）
- **担当チャット**: refactor-core
- **成果物の性格**: 調査 / 提案のみ。**本 PR に計装コード・修正は含まない**（Issue #1038 Scope 準拠 — 実装は別 Issue）
- **関連**: #994（実ブラウザ計測・chat-main 手番） / #992（仮想化） / #993（timer_sessions 購読） / [2026-08-13-mobile-performance.md](./2026-08-13-mobile-performance.md)（初回ロード側の実測）

---

## 0. 結論

**体感の正体は「呼び出しが多い」ことではなく、「切り替えるたびに前回の結果を捨て、取り直しが返るまで骨組みを見せる」こと**です。

冷蔵庫を開けるたびに中身を全部出して、また入れ直しているようなものです。1 回あたりの品数（REST 本数）はどれも 10 本前後で多くはありませんが、**戻ってきたときに使える作り置きがゼロ**なので、毎回「空の棚」を見る時間が挟まります。

| #   | 見つかったこと                                                                               | 実測の根拠 | 効きそうな手                                                   |
| --- | -------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------- |
| 1   | **戻ってきた側は必ず全件取り直し。キャッシュ利用は 0 本**（materials 復帰 = 5 本を再取得）   | §3.1       | 案 A（前回値を出してから裏で取り直す）                         |
| 2   | **その画面が表示に使わない読みが混ざる**（schedule 11 本中 3 本が Trash 用の削除済み一覧）   | §4.2 / 4.3 | 案 B（無駄取りの削減。schedule 11→8 / connect 7→5）            |
| 3   | **Materials のタブ切替だけでタグ 3 点セットを取り直す**（notes → daily = 4 本中 3 本がそれ） | §3.2       | 案 B（タブ 2 本の外へ Provider を 1 つ上げる。4→1 本）         |
| 4   | 初回訪問だけ chunk が乗る（開いた瞬間の最大 = analytics の gzip 104 KB、エディタで +121 KB） | §2.2       | 案 C（nav hover でプリフェッチ。本数は減らず、待ちを隠すだけ） |

---

## 1. 計測方法と、測れなかったもの

### 1.1 何をどう測ったか

使い捨ての計測ハーネス（vitest + jsdom、全文 = 付録 A）で、`web/src/sectionDescriptors.tsx` の `SECTION_DESCRIPTORS[section].body(...)` を **セクション層 Provider ごとマウント**し、次の 3 つを数えました。

1. **REST 本数** — `DataService` を Proxy で包み、呼ばれたメソッド名を数える（= Supabase へ出る要求の本数）
2. **commit 数** — React の `<Profiler>` の `onRender` 発火回数（= 画面が組み直された回数）
3. **chunk バイト数** — `cd web && npm run build` の `dist/assets/*.js` を `gzip -c` で自前計測

グローバル層（Toast / Sync / Timer / RightSidebar / Theme）は**切替を跨いで生き残る**ので、その分（TimerProvider の `fetchTimerSettings` / `fetchPomodoroPresets` の 2 本）は集計から外しています。数えているのは「切替のたびに払う分」だけです。

### 1.2 なぜ jsdom の計測に意味があるか

本数と commit 数は **データ量に依存しない**（0 件でも 1000 件でも同じ本数・同じ回数）ため、実データが無い環境でも正しい値が出ます。逆に**時間（ミリ秒）とペイントは実ブラウザでしか測れない**ので、本レポートは秒数を一切主張しません。

worktree チャットは playwright / dev server を使えない（CLAUDE.md §7.4）ため、**RTT・LCP・スクロール FPS は chat-main 手番**です（#994 と同じ切り分け）。

### 1.3 ハーネス側の落とし穴（同じ計測をやり直す人向け）

最初の 2 回は、**計測装置そのものが原因の無限ループ**で数値が壊れました。数値を信じる前にこの 2 つを潰す必要があります（詳細 = 付録 B）。

- `useTranslation` のモックが**毎レンダー新しい `t` を返す**と、`[ds, t]` を deps に持つ effect（例 = `web/src/work/WorkScreen.tsx:120`）が永久に再取得する
- Proxy が**毎回新しい関数・新しい配列**を返すと、identity を deps に持つ経路が同じく永久ループする（Trash で 15 万回の呼び出しを記録した）

---

## 2. 実測 — セクション 1 枚をマウントする費用

### 2.1 REST 本数と commit 数

| section       | REST 本数 | commit 数 | 内訳                                                                                                                                                                                                                     |
| ------------- | --------: | --------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **schedule**  |    **11** |         3 | `fetchTodoTree` / `fetchDeletedTodos` / `fetchCalendars` / `fetchAllRoutines` / `fetchDeletedRoutines` / `fetchScheduleItemsByDateRange` / `fetchScheduleItemsByDateAll` / `fetchDeletedScheduleItems` / タグ 3 点セット |
| **briefing**  |     **8** |         3 | `fetchScheduleItemsByDate`×2（今日 + 明日） / `fetchTodoTree` / `fetchTimerSessions` / `getDailyByDateUnified` / `getNoteUnified` / `listNotesUnified` / `listAllTagConnections`                                         |
| **analytics** |     **8** |         5 | `fetchScheduleItemsByDateRange`×2 / `fetchTimerSessions` / `fetchTodoTree` / `fetchAllRoutines` / `listNotesUnified` / `listAllWikiTagsUnified` / `listAllTagAssignments`                                                |
| **connect**   |     **7** |         5 | `listNotesUnified` / `listDailiesUnified` / `listAllWikiTagsUnified`×2 / `listAllTagAssignments`×2 / `listAllTagConnections`                                                                                             |
| **materials** |     **5** |         3 | `listNotesUnified` / `fetchDeletedNotesUnified` / タグ 3 点セット（notes タブ）                                                                                                                                          |
| **trash**     |     **5** |         2 | 削除済み 5 種                                                                                                                                                                                                            |
| **work**      |     **1** |         3 | `fetchTodoTree`                                                                                                                                                                                                          |
| **settings**  |     **0** |         2 | （ローカル設定のみ — DataService を触らない）                                                                                                                                                                            |

「タグ 3 点セット」= `listAllWikiTagsUnified` / `listAllTagAssignments` / `listAllTagConnections`（`WikiTagsUnifiedProvider` が 1 回の `Promise.all` で読む固定の 3 本）。

これらは `Promise.all` の中か、別々の effect が同じフレームで発火するかのどちらかで、**ほぼ同時に出ます**。つまり待ち時間は「本数 × 往復」ではなく「いちばん遅い 1 本」に近い。**本数そのものは体感の主犯ではありません**（主犯は §3.1）。ミリ秒での裏取りは実ブラウザ側（#994）の仕事です。

### 2.2 初回訪問だけ乗る chunk

`lazy()` 境界は 3 セクション（`web/src/lazySections.ts`）+ エディタ（`web/src/notes/LazyRichTextEditor.tsx`）+ Briefing のグラフ 2 枚（`shared/src/components/briefing/BriefingVizPanel.tsx`）です。初回ロードで落ちてくるのは entry の 1 本だけ（`index-*.js` = 1,345,764 B / gzip 362,182 B）で、以下は**そのセクションを初めて開いた時に**取得されます（2 回目以降はブラウザキャッシュ）。

| chunk                      | raw (B) | gzip (B) | 初めて要求するセクション         |
| -------------------------- | ------: | -------: | -------------------------------- |
| `RichTextEditor-*.js`      | 388,947 |  120,712 | materials / briefing / todo 詳細 |
| `CartesianChart-*.js`      | 296,394 |   87,526 | briefing（グラフ） / analytics   |
| `ConnectScreen-*.js`       | 101,271 |   29,559 | connect                          |
| `AnalyticsScreen-*.js`     |  59,719 |   15,990 | analytics                        |
| `WorkBreakBalance-*.js`    |  35,266 |   10,244 | briefing / analytics             |
| `NotesView-*.js`           |  30,470 |    9,244 | materials（notes）               |
| `TodoCompletionTrend-*.js` |  17,674 |    5,658 | briefing / analytics             |
| `string-*.js`              |   8,264 |    3,528 | （上記の共有依存）               |

chunk が落ちてくるのは「その境界が実際に描かれた瞬間」なので、セクションを開いた時点の追加ダウンロード（gzip）と、その中で操作を進めた時の追加分は分けて読む必要があります。

| 初めて開いたとき                   | 開いた瞬間 | そこから先に増える分                          |
| ---------------------------------- | ---------: | --------------------------------------------- |
| materials（notes）                 |       9 KB | ノートを開いてエディタが出ると **+121 KB**    |
| materials（daily）                 |       0 KB | 同上（日記本文がエディタ） **+121 KB**        |
| analytics                          | **104 KB** | タブによって trend / balance が **+16 KB**    |
| connect                            |  **30 KB** | —                                             |
| briefing（朝刊）                   |       0 KB | 詳細パネルを開くとグラフ **+103 KB**          |
| briefing（夕刊）                   |       0 KB | エディタ **+121 KB**（+ 詳細パネルで 103 KB） |
| schedule / work / settings / trash |       0 KB | —                                             |

2 回目以降はブラウザキャッシュなので 0 です。**chunk が効くのは「その日はじめてそのセクションを開いた 1 回だけ」** — 何度も行き来したときの重さは §3 の方が説明します。

---

## 3. 実測 — 切替そのもの

### 3.1 セクションを離れて戻る（materials → work → materials）

| 局面                    | REST 本数 | commit 数 | 内訳                                                              |
| ----------------------- | --------: | --------: | ----------------------------------------------------------------- |
| 離れる（→ work）        |         1 |         2 | `fetchTodoTree`                                                   |
| **戻る（→ materials）** |     **5** |         4 | `listNotesUnified` / `fetchDeletedNotesUnified` / タグ 3 点セット |

**戻りは初回マウントと完全に同じ 5 本**です。前回の結果は 1 本も再利用されていません。

理由は構造的で、`web/src/MainScreen.tsx:250` が `descriptor.body(...)` を差し替える＝**セクション層 Provider が unmount され、その state（＝取得済みデータ）ごと消える**ためです。新しくマウントされた側では `useDomainLoad` の `settled` が `null` から始まる（`shared/src/hooks/useDomainLoad.ts:149` — `settled === null` はそのまま `isLoading` true）ので、**取り直しが返るまで骨組み（スケルトン / 空リスト）が表示されます**。これが「わずかなロード」の正体です。

### 3.2 Materials のタブを切り替える（notes → daily）

| 局面          | REST 本数 | commit 数 | 内訳                                                 |
| ------------- | --------: | --------: | ---------------------------------------------------- |
| notes → daily |         4 |         4 | `listDailiesUnified` + **タグ 3 点セット（再取得）** |

セクションは変わっていないのにタグを読み直しています。`web/src/sectionDescriptors.tsx:215` と `:233` で、**notes 用と daily 用に別々の `WikiTagsUnifiedProvider` が置かれている**ため、タブを跨ぐと別インスタンスとして mount し直されるからです。**必要なのは `listDailiesUnified` の 1 本だけ**です。

---

## 4. 無駄の内訳（コード上の根拠）

### 4.1 復帰時にキャッシュが無い（構造 / 案 A の対象）

上記 §3.1 の通り。個々のフックの問題ではなく、「セクション層 Provider は切替で捨てる」という設計の帰結です。捨てること自体は Realtime の購読やメモリの観点で妥当なので、**捨てるのをやめる**より**捨てても前回値が残る場所を用意する**方が筋が良さそうです（案 A）。

### 4.2 その画面が表示に使わない読み（案 B の対象）

セクションのマウント時に、**Trash 専用の削除済み一覧**が一緒に読まれています。

| 読み                        | 起点                                          | 表示側の消費者                                                                            |
| --------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `fetchDeletedTodos`         | `shared/src/hooks/useTodoTreeAPI.ts:122`      | **画面には出ない**が、結果は `nodes` にマージされる（`:126`）— 消す前に読み手の調査が要る |
| `fetchDeletedRoutines`      | `shared/src/hooks/useRoutinesAPI.ts:65`       | **無し**                                                                                  |
| `fetchDeletedScheduleItems` | `shared/src/hooks/useScheduleItemsAPI.ts:122` | **無し**                                                                                  |
| `fetchDeletedNotesUnified`  | `shared/src/hooks/useNotesUnifiedAPI.ts:201`  | **有り** — Notes サイドバーのゴミ箱行（`web/src/notes/NotesSidebarList.tsx:269`）         |

しかも Trash 画面は Provider のキャッシュを見ておらず、`web/src/trash/TrashScreen.tsx:76-80` で **5 本を自前で取り直します**。つまり上 3 本は「誰も表示に使わないのに、schedule を開くたび（と sync bump のたび）に走る」読みです。各フックのコメントは「Trash を先に温めておく」意図を明記しているので、**意図の廃止判断が要ります**（消すか、Trash 側がキャッシュを読む形にするか）。

### 4.3 Connect の二重読み（案 B の対象）

`web/src/connect/ConnectScreen.tsx:80-81` がグラフ用に `listAllWikiTagsUnified` / `listAllTagAssignments` を自前で読み、同じ画面が内側に持つ `WikiTagsUnifiedProvider` も 3 点セットを読みます。7 本中 2 本が同じ要求の重複です。

### 4.4 Materials のタブごと Provider（案 B の対象）

§3.2 の通り。`WikiTagsUnifiedProvider` をタブ 2 本の**外側に 1 つ**出すだけで、タブ切替は 4 本 → 1 本になります。

---

## 5. 案（コスト・退行リスク付き）

### 案 A — 取り直しの前に「前回値」を出す（stale-while-revalidate）

**やること**: `shared/src/hooks/useDomainLoad.ts` の裏に、ドメイン単位のモジュールレベル・スナップショット置き場を作る。mount 時にスナップショットがあれば**まずそれを描き、`loading` を立てずに**裏で取り直して差し替える。

**効き**: 復帰時の骨組みが消える（§3.1 の「5 本が返るまで空」→「前回の一覧が即出て、返ったら更新」）。**REST 本数は変わらない**。体感に直接効くのはこれ 1 本です。

**コスト**: shared のフック 1 本 + 小さな store 1 ファイル。既に同型の前例が `shared/src/hooks/useLazyStalePool.ts`（"lazy stale pool"）にあるので、新しい概念を持ち込まずに済みます。

**退行リスク（中）**: 一瞬だけ古い値が出る。MCP や他デバイスからの変更直後に戻ると、取り直しが返るまで古い一覧が見える（現状は「空」なので、どちらが誤解を招くかは判断が割れます）。削除済みアイテムが 1 フレーム見えるケースの扱いが要検討。

**保存先の選択肢**: メモリ（タブを閉じたら消える）か localStorage（リロードでも残る）か。Issue #1038 が挙げている「ローカルストレージ等でのキャッシュ」はここに当たります。localStorage 版は初回ロードの体感にも効く一方、**古いスキーマの残骸**という別のリスクを持ち込みます（→ 判断キュー）。

### 案 B — 無駄取りの削減（構造は触らない）

**やること**: §4.2 の 3 本を消す（または Trash 側に寄せる） / §4.3 の重複 2 本を Provider 経由に一本化 / §4.4 の Provider をタブの外に 1 つ上げる。

**効き（実測ベース）**: schedule **11 → 8 本**（−27%） / connect **7 → 5 本**（−29%） / Materials のタブ切替 **4 → 1 本**（−75%）。復帰時の「空の時間」は**短くならない**（本数が減っても 1 往復は残る）ので、これ単独では体感は変わりにくい。

**コスト**: 小。触るのは shared のフック 3 本 + `web/src/connect/ConnectScreen.tsx` + `web/src/sectionDescriptors.tsx`。

**退行リスク（小〜中）**: `fetchDeletedTodos` は結果が `nodes` にマージされている（`useTodoTreeAPI.ts:126`）ため、消す前に「削除済みノードを前提にした読み手がいないか」の確認が要ります。Routines / ScheduleItems の 2 本は表示側の消費者が見つからず、より安全。

### 案 C — 意図が見えた時点でプリフェッチ

**やること**: nav 項目の hover / pointerdown で、そのセクションの `lazy()` chunk を先読みし、必要なら取得も先に投げる。

**効き**: **初回訪問**の chunk 待ち（§2.2 — 開いた瞬間で最大 104 KB、エディタを開くと +121 KB）を隠す。2 回目以降は元々キャッシュ済みなので効かない。

**コスト**: 小（`lazy()` の各エクスポートに preload 用の関数を足し、nav 側で呼ぶ）。

**退行リスク（小）**: 素通りの hover で使わない chunk を落とす。モバイルは hover が無いので効かない（タップ時の pointerdown なら数十 ms 早い程度）。

### 3 案の関係

**A が本命、B は A と独立に効く掃除、C は初回だけの上乗せ**です。A と B は互いに邪魔をしません（B で減らした分だけ A の revalidate も軽くなる）。

---

## 6. 判断キューに上げたもの

`.claude/comm/decisions/chat-refactor-core.md` に **D-20260818-refactor-1**（どの案から着手するか / キャッシュの保存先をメモリか localStorage か）を追加しました。回答が付いたら実装 Issue を起票します（本 Issue は調査までが Scope）。

---

## 付録 A — 計測ハーネス（使い捨て・本 PR には含めない）

`web/tests/` に置いて `npx vitest run` すれば再現できます。commit しないのは、これが**製品の振る舞いを固定するテストではなく、その時点の数値を採るための道具**だからです（緑を保つ責任だけが残り、壊れても誰も困らない）。

```tsx
// web/tests/zz-measure-1038.test.tsx（抜粋 — 全体の骨格）
const counts = new Map<string, number>();
let commits = 0;

// 毎レンダー同じオブジェクトを返す（= 実 i18next の挙動。付録 B 参照）
const I18N = { t: (key: string) => key, i18n: { language: "en" } };
vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useTranslation: () => I18N,
}));

// メソッドと戻り値の identity を固定した DataService（付録 B 参照）
const methodCache = new Map<string, () => Promise<unknown>>();
const resultCache = new Map<string, unknown>();
const ds = new Proxy(
  {},
  {
    get(_t, prop: string) {
      if (prop === "then") return undefined;
      let fn = methodCache.get(prop);
      if (!fn) {
        if (!resultCache.has(prop)) resultCache.set(prop, defaultFor(prop));
        fn = () => {
          counts.set(prop, (counts.get(prop) ?? 0) + 1);
          return Promise.resolve(resultCache.get(prop));
        };
        methodCache.set(prop, fn);
      }
      return fn;
    },
  },
) as DataService;

// セクション層より外は切替を跨いで生き残るので、外側に置いて集計から外す
function Shell({ section, tab }: { section: SectionId; tab?: string }) {
  return (
    <ThemeProvider>
      <ToastProvider dismissLabel="close">
        <SyncStub>
          <TimerProvider dataService={ds} untitledTodoTitle="untitled">
            <RightSidebarProvider>
              <Body section={section} tab={tab} />
            </RightSidebarProvider>
          </TimerProvider>
        </SyncStub>
      </ToastProvider>
    </ThemeProvider>
  );
}

function Body({ section, tab }: { section: SectionId; tab?: string }) {
  const nav = useShellNavigation();
  return (
    <Profiler id="body" onRender={() => (commits += 1)}>
      {SECTION_DESCRIPTORS[section].body({
        ds,
        nav: { ...nav, section, materialsTab: tab ?? nav.materialsTab },
        narrowTabRow: undefined,
        loadingFallback: <p>loading</p>,
      })}
    </Profiler>
  );
}
```

`connect` は jsdom に `ResizeObserver` が無いので空実装を 1 つ足す必要があります。`settings` は `ThemeProvider` が要ります。

## 付録 B — 計測装置が生んだ偽の数値（2 件）

いずれも「アプリの無限ループ」ではなく**ハーネスの作りが引き起こしたもの**でした。数値を採る前に潰す必要があります。

1. **`t` の identity**: `useTranslation: () => ({ t: … })` と書くと毎レンダー新しいオブジェクトと新しい `t` が返る。`useEffect(…, [ds, t])` を持つ画面（`web/src/work/WorkScreen.tsx:120`）が毎レンダー再取得し、20 秒でタイムアウトした。実 i18next の `t` は言語ごとに安定なので、モックも 1 個のオブジェクトを使い回す。
2. **戻り値の identity**: Proxy が毎回新しい配列を返すと、取得結果を deps に持つ経路が永久に回る。Trash で **155,725 回**の呼び出し / 31,148 commit を記録した（実アプリの値ではない）。メソッド関数と戻り値をそれぞれキャッシュして identity を固定すると 5 本 / 2 commit に落ち着く。

この 2 件は、同じ手法で他画面を測る人が最初に踏む石です。
