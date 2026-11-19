// 返った朝刊の JSON を検査し、write_briefing へ渡す段落に組み立てる。
// 通らなければ書き込まない（呼び出し側が例外を受けて止める）。

export class ValidationError extends Error {
  constructor(problems) {
    super(`briefing validation failed: ${problems.join(" / ")}`);
    this.name = "ValidationError";
    this.problems = problems;
  }
}

// 改行以外の制御文字・書式文字（双方向制御やゼロ幅の文字、タグ文字）・行区切りを弾く。表示の偽装に使われるため
const INVISIBLE = /^[\p{Cc}\p{Cf}\p{Co}\p{Cn}\p{Zl}\p{Zp}]$/u;
// ZWJ と絵文字の異体字選択子は、絵文字の列に正当に入るので許す
const EMOJI_JOINERS = new Set([String.fromCodePoint(0x200d), String.fromCodePoint(0xfe0f)]);
function hasControl(v) {
  for (const ch of v) if (ch !== "\n" && !EMOJI_JOINERS.has(ch) && INVISIBLE.test(ch)) return true;
  return false;
}

// URL を出してよいのは news[].url だけ。ほかの項目に混ざったリンクは、検索結果に潜んだ指示で書かれた恐れがある
// スキームの無い裸のドメイン（claude.ai など）は、開けないうえに話題に自然に出るので弾かない
const LINK_LIKE = /https?:\/\/|www\.|\]\(/i;

/** 文字数は、画面に出る文字（サロゲートペアを 1 つ）で数える。 */
export function charLength(s) {
  return [...s].length;
}

function isOneSentence(s) {
  if (/[\r\n]/.test(s)) return false;
  const stops = (s.match(/[。！？!?]/g) ?? []).length;
  if (stops === 0) return true;
  if (stops > 1) return false;
  return /[。！？!?]$/.test(s.trim());
}

function checkUrl(url, allowedUrls, problems, label) {
  if (typeof url !== "string" || !url.startsWith("https://") || /\s/.test(url)) {
    problems.push(`${label}: URL は https:// で始まり空白を含まない必要があります`);
    return;
  }
  try {
    new URL(url);
  } catch {
    problems.push(`${label}: URL として読めません`);
    return;
  }
  if (allowedUrls && !allowedUrls.has(url)) {
    problems.push(`${label}: URL が検索の結果に出ていません`);
  }
}

/**
 * @param {unknown} b compose が返した JSON
 * @param {object} config config.json の中身
 * @param {{ allowedUrls?: Set<string> }} [opts] 検索の結果に出た URL。ニュースの URL はこの中だけを許す
 * @returns {{ focus: string, paragraphs: string[] }}
 */
export function validateBriefing(b, config, opts = {}) {
  const problems = [];
  const limits = config.limits;
  if (typeof b !== "object" || b === null) throw new ValidationError(["JSON のオブジェクトではありません"]);

  const text = (v, label) => {
    if (typeof v !== "string") {
      problems.push(`${label}: 文字列ではありません`);
      return "";
    }
    if (hasControl(v)) problems.push(`${label}: 制御文字を含みます`);
    if (LINK_LIKE.test(v)) problems.push(`${label}: URL やリンクを含みます（URL は news の url だけに書きます）`);
    return v.trim();
  };

  const focus = text(b.focus, "focus");
  if (!focus) problems.push("focus: 空です");
  else {
    if (charLength(focus) > limits.focusChars) problems.push(`focus: ${limits.focusChars} 字を超えています`);
    if (!isOneSentence(focus)) problems.push("focus: 1 文ではありません");
  }

  const today = text(b.today, "today");
  if (!today) problems.push("today: 空です");

  const news = Array.isArray(b.news) ? b.news : (problems.push("news: 配列ではありません"), []);
  if (news.length > config.newsCount) problems.push(`news: ${config.newsCount} 件を超えています`);
  if (!config.newsTopic && news.length > 0) problems.push("news: 題材が空なのに記事が出ています");
  const newsLines = [];
  news.forEach((n, i) => {
    const label = `news[${i}]`;
    if (typeof n !== "object" || n === null) return problems.push(`${label}: オブジェクトではありません`);
    const title = text(n.title, `${label}.title`);
    const summary = text(n.summary, `${label}.summary`);
    if (!title || !summary) problems.push(`${label}: title と summary が必要です`);
    if (charLength(title) > limits.titleChars) problems.push(`${label}.title: ${limits.titleChars} 字を超えています（${charLength(title)} 字）`);
    if (charLength(summary) > limits.summaryChars) problems.push(`${label}.summary: ${limits.summaryChars} 字を超えています（${charLength(summary)} 字）`);
    checkUrl(n.url, opts.allowedUrls ?? new Set(), problems, label);
    newsLines.push(`ニュース: ${title}。${summary} ${n.url}`);
  });

  const learning = text(b.learning ?? "", "learning");
  if (config.learningTopic && !learning) problems.push("learning: 空です");
  if (!config.learningTopic && learning) problems.push("learning: 題材が空なのに出ています");
  if (charLength(learning) > 300) problems.push("learning: 300 字を超えています");

  const paragraphs = [today, ...newsLines, learning ? `学びの 1 問: ${learning}` : ""].filter(Boolean);
  if (paragraphs.length > limits.maxParagraphs) problems.push(`段落が ${limits.maxParagraphs} 個を超えています`);
  paragraphs.forEach((p, i) => {
    if (charLength(p) > limits.paragraphChars) problems.push(`段落 ${i + 1}: ${limits.paragraphChars} 字を超えています`);
  });

  if (problems.length > 0) throw new ValidationError(problems);
  return { focus, paragraphs };
}
