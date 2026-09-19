/*
 * Japanese names for the curated tag icons (#1701).
 *
 * WHY this table exists at all: every icon in TAG_ICONS is keyed by its lucide
 * name, which is English and often a word nobody reaches for in Japanese
 * ("PawPrint" for a pet tag, "FlaskConical" for a study one). #1700 took the
 * set to 146, past the size where scrolling the grid finds anything, so the
 * picker grew a search field — and a search field over English-only names
 * would be unusable for the person the app is for.
 *
 * WHY it is hand-written rather than generated: nothing derives the word a
 * person types from a lucide name. `Dumbbell` is reached by 筋トレ far more
 * often than by ダンベル, and `Landmark` here is the bank, not the landmark.
 * Only a choice per icon gets that right.
 *
 * WHY one space-separated string per icon rather than an array of strings:
 * prettier breaks a 7-element array across 9 lines, which turned this table
 * into ~1,000 lines where every added word moved the four below it. One line
 * per icon keeps a diff to the icon that changed. The cost is that an alias
 * cannot itself contain a space — no Japanese word here wants one, and
 * `aliasesOf` would silently split it if one did, so the suite checks.
 *
 * WHAT GOES IN EACH ONE: the words someone would actually type for that glyph,
 * written the way they would type them. Where a reading splits between kana
 * and kanji (猫 / ねこ), BOTH go in — matching is literal substring, with no
 * reading conversion anywhere, so 「ねこ」 cannot find 「猫」 on its own. The
 * hiragana forms are also what make the mid-conversion case work: the picker
 * filters on every keystroke, so a half-typed 「きん」 has to land on
 * 「きんとれ」 before the IME has committed anything.
 *
 * The English lucide name is NOT repeated here — `matchesTagIconQuery` tests
 * it separately, so `dumb` finds Dumbbell without an entry saying so.
 *
 * COMPLETENESS is a test, not a convention: `tagIconAliases.test.ts` fails if
 * any TAG_ICONS key is missing from this table, which is what keeps #1700's
 * "add an icon" step from quietly producing a glyph nobody can search for.
 *
 * WHAT IT COSTS: this table plus the search field took the eager index chunk
 * 1,105.24 KB → 1,119.39 KB raw and 307.62 KB → 315.11 KB gzip (+7.49 KB) on
 * top of the +9.91 KB #1700 spent on the icons themselves. Japanese text is
 * three bytes a character and compresses poorly, so the table is most of it.
 * It ships eagerly because the Connect screen is not code-split (rules/
 * frontend.md), but nothing reads it until the panel is opened — if that
 * ~7.5 KB ever needs to come back, deferring THIS module behind the panel's
 * open is the cheapest cut available and costs only a first-keystroke await.
 */

import { TAG_ICON_CHOICES } from "./tagIcon";

/**
 * Japanese words for each curated icon, space-separated, keyed by its lucide
 * name. Grouped and ordered to match TAG_ICONS so the two read side by side.
 */
const ALIAS_WORDS: Readonly<Record<string, string>> = {
  // General
  Tag: "タグ 付箋 ふせん ラベル",
  Hash: "ハッシュ 番号 ばんごう シャープ 井桁 いげた",
  Star: "星 ほし スター お気に入り おきにいり 評価 ひょうか",
  Heart: "ハート 心 こころ 好き すき 愛 あい",
  Flag: "旗 はた フラグ 目印 めじるし 優先 ゆうせん",
  Bookmark: "しおり 栞 ブックマーク あとで読む あとでよむ",
  Circle: "丸 まる 円 えん サークル",
  Folder: "フォルダ ふぉるだ 書類入れ しょるいいれ 分類 ぶんるい",
  File: "ファイル 書類 しょるい 資料 しりょう",
  Home: "家 いえ ホーム 自宅 じたく 住まい すまい",
  Briefcase: "仕事 しごと 鞄 かばん ビジネス",
  Book: "本 ほん 書籍 しょせき 読書 どくしょ",
  Calendar: "カレンダー 予定 よてい 日付 ひづけ 暦 こよみ",
  Clock: "時計 とけい 時間 じかん 時刻 じこく",
  Coffee: "コーヒー こーひー 珈琲 カフェ 休憩 きゅうけい",
  Music: "音楽 おんがく ミュージック 音符 おんぷ 曲 きょく",
  Zap: "稲妻 いなずま 電気 でんき 雷 かみなり 急ぎ いそぎ",
  Sun: "太陽 たいよう 晴れ はれ 昼 ひる 朝 あさ",
  Moon: "月 つき 夜 よる 就寝 しゅうしん 夜間 やかん",
  Cloud: "雲 くも 曇り くもり クラウド",
  Leaf: "葉 は 葉っぱ はっぱ 植物 しょくぶつ エコ",
  Code: "コード プログラム 開発 かいはつ プログラミング",
  Lightbulb: "電球 でんきゅう アイデア ひらめき 思いつき おもいつき",
  Sparkles: "きらきら キラキラ 輝き かがやき 特別 とくべつ",
  Target: "的 まと 目標 もくひょう ターゲット 狙い ねらい",
  Pin: "ピン 固定 こてい 押しピン おしぴん 留める とめる",
  Bell: "ベル 鐘 かね 通知 つうち 知らせ しらせ リマインド",
  Inbox: "受信箱 じゅしんばこ 受信 じゅしん インボックス 未処理 みしょり",
  Archive: "保管 ほかん アーカイブ 書庫 しょこ 保存 ほぞん",
  Layers: "重ね かさね レイヤー 層 そう 階層 かいそう",
  Award: "賞 しょう 表彰 ひょうしょう メダル 実績 じっせき",
  Gift: "贈り物 おくりもの プレゼント ギフト 誕生日 たんじょうび",
  // Life
  Bed: "ベッド 寝る ねる 睡眠 すいみん 寝室 しんしつ",
  ShoppingCart: "買い物 かいもの カート ショッピング 買物 スーパー",
  Shirt: "シャツ 服 ふく 衣類 いるい 洋服 ようふく",
  PawPrint: "足跡 あしあと 肉球 にくきゅう ペット 動物 どうぶつ",
  Bath: "風呂 ふろ お風呂 おふろ 入浴 にゅうよく バス",
  Sofa: "ソファ 椅子 いす 家具 かぐ リビング くつろぎ",
  Baby: "赤ちゃん あかちゃん 育児 いくじ ベビー 子供 こども",
  Dog: "犬 いぬ ドッグ ペット 散歩 さんぽ",
  Cat: "猫 ねこ キャット ペット",
  WashingMachine: "洗濯 せんたく 洗濯機 せんたくき 家事 かじ",
  // Work
  Building2: "ビル 会社 かいしゃ オフィス 職場 しょくば 勤務 きんむ",
  Mail: "メール 手紙 てがみ 郵便 ゆうびん 連絡 れんらく",
  Users: "人 ひと メンバー チーム 仲間 なかま 会議 かいぎ",
  Handshake: "握手 あくしゅ 契約 けいやく 商談 しょうだん 提携 ていけい",
  Presentation: "発表 はっぴょう プレゼン 資料 しりょう 説明 せつめい",
  ChartColumn:
    "グラフ 棒グラフ ぼうぐらふ 集計 しゅうけい 分析 ぶんせき 数字 すうじ",
  ClipboardList: "一覧 いちらん チェックリスト 台帳 だいちょう 持ち物 もちもの",
  Printer: "印刷 いんさつ プリンタ プリンター コピー",
  Laptop: "パソコン ぱそこん ノートパソコン ラップトップ 端末 たんまつ",
  // Study
  GraduationCap:
    "卒業 そつぎょう 勉強 べんきょう 学習 がくしゅう 学位 がくい 大学 だいがく",
  Pencil: "鉛筆 えんぴつ 書く かく メモ 筆記 ひっき",
  Library: "図書館 としょかん 本棚 ほんだな 蔵書 ぞうしょ",
  FlaskConical: "フラスコ 実験 じっけん 化学 かがく 理科 りか",
  BookOpen:
    "開いた本 ひらいたほん 教科書 きょうかしょ 読書 どくしょ 精読 せいどく",
  NotebookPen: "ノート のーと 記録 きろく 書き込み かきこみ 日誌 にっし",
  Highlighter:
    "蛍光ペン けいこうぺん マーカー 線引き せんびき 強調 きょうちょう",
  Ruler: "定規 じょうぎ ものさし 物差し 測る はかる 寸法 すんぽう",
  Calculator: "電卓 でんたく 計算 けいさん 算数 さんすう",
  Microscope: "顕微鏡 けんびきょう 観察 かんさつ 研究 けんきゅう",
  // Health
  Dumbbell:
    "筋トレ きんとれ 運動 うんどう ダンベル ジム 筋肉 きんにく トレーニング",
  HeartPulse: "心拍 しんぱく 脈 みゃく 健康 けんこう 心臓 しんぞう",
  Pill: "薬 くすり 錠剤 じょうざい サプリ 服薬 ふくやく",
  Stethoscope: "聴診器 ちょうしんき 医者 いしゃ 診察 しんさつ 通院 つういん",
  Activity: "活動 かつどう 心電図 しんでんず バイタル 記録 きろく",
  Bike: "自転車 じてんしゃ サイクリング バイク 通学 つうがく",
  Footprints: "足跡 あしあと 歩く あるく 散歩 さんぽ ウォーキング 歩数 ほすう",
  Syringe: "注射 ちゅうしゃ 予防接種 よぼうせっしゅ ワクチン 採血 さいけつ",
  Thermometer: "体温計 たいおんけい 温度 おんど 熱 ねつ 気温 きおん",
  Brain: "脳 のう 思考 しこう 記憶 きおく 頭 あたま メンタル",
  // Money
  Wallet: "財布 さいふ お金 おかね 支払い しはらい",
  PiggyBank: "貯金 ちょきん 節約 せつやく 貯金箱 ちょきんばこ 積立 つみたて",
  CreditCard: "カード クレジットカード 決済 けっさい 支払い しはらい",
  Coins: "硬貨 こうか コイン 小銭 こぜに お金 おかね",
  Banknote: "紙幣 しへい お札 おさつ 現金 げんきん",
  JapaneseYen: "円 えん 日本円 にほんえん 金額 きんがく 値段 ねだん",
  Receipt: "領収書 りょうしゅうしょ レシート 明細 めいさい 家計簿 かけいぼ",
  Landmark: "銀行 ぎんこう 役所 やくしょ 公共 こうきょう 税金 ぜいきん",
  TrendingUp:
    "上昇 じょうしょう 増加 ぞうか 成長 せいちょう 投資 とうし 右肩上がり みぎかたあがり",
  ShoppingBag:
    "買い物袋 かいものぶくろ ショッピングバッグ 購入 こうにゅう 買い物 かいもの",
  // Travel
  Plane: "飛行機 ひこうき 空港 くうこう 旅行 りょこう フライト",
  Car: "車 くるま 自動車 じどうしゃ ドライブ 運転 うんてん",
  TrainFront: "電車 でんしゃ 列車 れっしゃ 通勤 つうきん 鉄道 てつどう 駅 えき",
  MapPin: "場所 ばしょ 位置 いち ピン 目的地 もくてきち 地図 ちず",
  Bus: "バス ばす 路線バス ろせんばす 送迎 そうげい",
  Ship: "船 ふね フェリー 港 みなと 航海 こうかい",
  Map: "地図 ちず マップ 経路 けいろ 案内 あんない",
  Navigation: "ナビ 案内 あんない 方向 ほうこう 経路 けいろ 出発 しゅっぱつ",
  Luggage: "荷物 にもつ スーツケース 旅行 りょこう キャリーケース",
  Globe: "地球 ちきゅう 世界 せかい グローバル 海外 かいがい 国際 こくさい",
  // Food
  Utensils:
    "食事 しょくじ ごはん ご飯 レストラン 外食 がいしょく 食器 しょっき",
  Pizza: "ピザ ぴざ イタリアン 宅配 たくはい",
  Apple: "りんご リンゴ 林檎 果物 くだもの フルーツ",
  Wine: "ワイン わいん お酒 おさけ 酒 さけ 晩酌 ばんしゃく",
  Beer: "ビール びーる 生ビール なまびーる お酒 おさけ 飲み会 のみかい",
  Cake: "ケーキ けーき お菓子 おかし デザート 誕生日 たんじょうび",
  IceCreamCone: "アイス あいす アイスクリーム ソフトクリーム おやつ",
  Sandwich: "サンドイッチ さんどいっち 軽食 けいしょく パン 昼食 ちゅうしょく",
  Soup: "スープ すーぷ 汁物 しるもの 味噌汁 みそしる 鍋 なべ",
  Salad: "サラダ さらだ 野菜 やさい ヘルシー 健康食 けんこうしょく",
  // Hobby
  Camera: "カメラ かめら 写真 しゃしん 撮影 さつえい",
  Gamepad2: "ゲーム げーむ コントローラー 遊び あそび ゲーム機 げーむき",
  Palette: "絵 え 絵の具 えのぐ パレット 色 いろ 美術 びじゅつ アート",
  Film: "映画 えいが フィルム 動画 どうが 映像 えいぞう",
  Guitar: "ギター ぎたー 楽器 がっき 演奏 えんそう バンド",
  Headphones: "ヘッドホン へっどほん イヤホン 音楽 おんがく リスニング",
  Mic: "マイク まいく 録音 ろくおん 歌 うた カラオケ 配信 はいしん",
  Dices: "サイコロ さいころ ボードゲーム 賽 運 うん",
  Tent: "テント てんと キャンプ きゃんぷ 野外 やがい アウトドア",
  // Nature
  Trees: "木々 きぎ 森 もり 林 はやし 自然 しぜん 公園 こうえん",
  TreePine: "松 まつ 針葉樹 しんようじゅ 木 き 森林 しんりん クリスマス",
  Flower: "花 はな 花見 はなみ 園芸 えんげい フラワー",
  Sprout:
    "芽 め 新芽 しんめ 発芽 はつが 家庭菜園 かていさいえん 成長 せいちょう",
  Mountain: "山 やま 登山 とざん ハイキング 山登り やまのぼり",
  Bird: "鳥 とり 野鳥 やちょう さえずり バード",
  // Weather
  CloudRain: "雨 あめ 降水 こうすい 梅雨 つゆ 雨天 うてん",
  CloudSnow: "雪 ゆき 降雪 こうせつ 雪模様 ゆきもよう",
  Snowflake: "雪 ゆき 結晶 けっしょう 冬 ふゆ 寒い さむい 冷凍 れいとう",
  Umbrella: "傘 かさ 雨具 あまぐ 雨 あめ 日傘 ひがさ",
  Wind: "風 かぜ 強風 きょうふう 台風 たいふう そよ風 そよかぜ",
  Rainbow: "虹 にじ レインボー 七色 なないろ",
  // Tools
  Wrench: "レンチ れんち 工具 こうぐ 修理 しゅうり 整備 せいび 設定 せってい",
  Hammer: "ハンマー はんまー 金槌 かなづち 工事 こうじ 日曜大工 にちようだいく",
  Drill: "ドリル どりる 電動工具 でんどうこうぐ 穴あけ あなあけ 工具 こうぐ",
  Scissors: "はさみ ハサミ 鋏 切る きる 裁断 さいだん 工作 こうさく",
  Paintbrush: "刷毛 はけ 筆 ふで 塗装 とそう ペンキ 塗る ぬる",
  Plug: "プラグ ぷらぐ 電源 でんげん コンセント 充電 じゅうでん",
  // Communication
  Phone: "電話 でんわ 通話 つうわ コール 連絡 れんらく",
  MessageCircle:
    "メッセージ めっせーじ チャット 吹き出し ふきだし 会話 かいわ コメント",
  Send: "送信 そうしん 送る おくる 送付 そうふ 紙飛行機 かみひこうき",
  Megaphone:
    "拡声器 かくせいき メガホン 告知 こくち 宣伝 せんでん お知らせ おしらせ",
  Wifi: "ワイファイ わいふぁい 無線 むせん ネット 通信 つうしん 電波 でんぱ",
  Smartphone: "スマホ すまほ スマートフォン 携帯 けいたい 端末 たんまつ",
  // Places
  Store: "店 みせ お店 おみせ 商店 しょうてん ショップ コンビニ",
  Building: "建物 たてもの ビル マンション 建築 けんちく",
  School: "学校 がっこう 校舎 こうしゃ 通学 つうがく 授業 じゅぎょう",
  Church: "教会 きょうかい 礼拝 れいはい 結婚式 けっこんしき チャペル",
  Castle: "城 しろ お城 おしろ 史跡 しせき 観光 かんこう",
  Hotel: "ホテル ほてる 宿 やど 宿泊 しゅくはく 旅館 りょかん",
  // Symbols
  Square: "四角 しかく 正方形 せいほうけい スクエア 箱 はこ",
  Triangle: "三角 さんかく 三角形 さんかっけい トライアングル",
  Diamond: "ひし形 ひしがた 菱形 ダイヤ ダイヤモンド",
  Shapes: "図形 ずけい かたち 形 シェイプ",
  Crown: "王冠 おうかん クラウン 冠 かんむり 優勝 ゆうしょう 一番 いちばん",
  Gem: "宝石 ほうせき ジュエリー ダイヤ 貴重 きちょう",
};

/** The words for one icon, or an empty list for a name nobody curated. */
function aliasesOf(name: string): readonly string[] {
  if (!Object.hasOwn(ALIAS_WORDS, name)) return [];
  return ALIAS_WORDS[name].split(" ");
}

/**
 * Japanese aliases per curated icon, keyed by lucide name. Built once from
 * ALIAS_WORDS so callers (and the suite) see a plain list per icon.
 */
export const TAG_ICON_ALIASES: Readonly<Record<string, readonly string[]>> =
  Object.fromEntries(
    Object.keys(ALIAS_WORDS).map((name) => [name, aliasesOf(name)]),
  );

/**
 * Does this icon match what the user has typed?
 *
 * The English lucide name and the Japanese aliases are ORed, both as plain
 * substring tests. Case folds on the English side only — Japanese has no case,
 * and `toLowerCase()` on kana is a no-op, so the one fold covers both.
 *
 * Deliberately NOT fuzzy: the set is 146 short names, and a fuzzy match over
 * that many returns half the grid for two characters. Substring keeps "what I
 * typed is in the answer" true, which is the property that makes the result
 * list trustworthy while an IME is still mid-conversion.
 */
export function matchesTagIconQuery(name: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (name.toLowerCase().includes(needle)) return true;
  return aliasesOf(name).some((alias) => alias.includes(needle));
}

/**
 * The curated choices that match `query`, in TAG_ICONS declaration order — so
 * an empty query gives back exactly the grid the picker drew before #1701.
 */
export function filterTagIcons(query: string): readonly string[] {
  if (!query.trim()) return TAG_ICON_CHOICES;
  return TAG_ICON_CHOICES.filter((name) => matchesTagIconQuery(name, query));
}
