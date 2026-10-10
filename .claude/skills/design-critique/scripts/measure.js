// design-critique の計測スクリプト（Playwright MCP 専用・実ブラウザ専用）。
//
// 使い方: browser_run_code_unsafe に filename としてこのファイルの絶対パスを渡す。
// 中身をコピーして code に貼らない（整形で末尾に ";" が付くと SyntaxError になる）。
//
// 画面の一部だけを測るときは、先に browser_evaluate で
//   () => { window.__designCritiqueRoot = "main"; }
// のようにセレクタを置いておく（未設定ならページ全体）。
//
// 返り値は JSON。scratchpad に保存して before / after を比べる。
// 見えていない要素（幅か高さが 0、display:none、visibility:hidden、opacity 0）は数えない。
// jsdom には座標が無いので vitest からは使えない（CLAUDE.md §7.1）。
//
// 末尾に ";" を付けないため、prettier の整形対象から外している。
// prettier-ignore
async (page) => page.evaluate(
  () => {
    const ROOT_SELECTOR = window.__designCritiqueRoot || null;
    // 余白の段階。tokens.css の --spacing-lumen-1 / 2 / 3 / 4 / 6 は 4px の倍数（#2036）。
    const SPACING_STEP_PX = 4;
    // 長さの 3 段（ms）。tokens.css の --duration-lumen-fast / normal / slow と同じ値で、
    // 段と一致する長さだけを帯の中とみなす。説明は frontend-react-designer の motion.md §3。
    const MOTION_BANDS = [
      [150, 150],
      [250, 250],
      [400, 400],
    ];
    const TAP_MIN_PX = 44;
    const narrow = window.innerWidth < 768;
  
    const root = ROOT_SELECTOR
      ? document.querySelector(ROOT_SELECTOR)
      : document.body;
    if (!root) return { error: `ROOT_SELECTOR not found: ${ROOT_SELECTOR}` };
  
    const isVisible = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const cs = getComputedStyle(el);
      return (
        cs.display !== "none" &&
        cs.visibility !== "hidden" &&
        Number(cs.opacity) > 0
      );
    };
    const px = (v) => Math.round(parseFloat(v) * 10) / 10;
    const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1);
    const toSorted = (map) =>
      [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ value, count }));
    const describe = (el) => {
      const label =
        el.getAttribute("aria-label") ||
        el.getAttribute("title") ||
        (el.textContent || "").trim().slice(0, 24);
      const cls =
        typeof el.className === "string"
          ? el.className.split(/\s+/).slice(0, 3).join(".")
          : "";
      return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${label ? ` "${label}"` : ""}`;
    };
    const toMs = (v) =>
      v.split(",").map((s) => {
        const t = s.trim();
        return t.endsWith("ms") ? parseFloat(t) : parseFloat(t) * 1000;
      });
  
    const all = [root, ...root.querySelectorAll("*")].filter(isVisible);
  
    // ---- アイコン -------------------------------------------------------------
    // lucide-react は全アイコンに "lucide lucide-<name>" の class を付ける。
    const iconNames = new Map();
    const iconSizes = new Map();
    const unlabeledIconOnly = [];
    for (const svg of all.filter((el) => el.tagName.toLowerCase() === "svg")) {
      const cls = svg.getAttribute("class") || "";
      const name =
        (cls.match(/lucide-([a-z0-9-]+)/) || [])[1] || "(non-lucide svg)";
      bump(iconNames, name);
      const r = svg.getBoundingClientRect();
      bump(iconSizes, `${Math.round(r.width)}x${Math.round(r.height)}`);
      const control = svg.closest("button, a, [role='button']");
      if (control && (control.textContent || "").trim() === "") {
        const named =
          control.getAttribute("aria-label") ||
          control.getAttribute("aria-labelledby") ||
          control.getAttribute("title");
        if (!named) unlabeledIconOnly.push(describe(control));
      }
    }
  
    // ---- 余白 ---------------------------------------------------------------
    const spacing = new Map();
    const offScale = new Map();
    const SPACING_PROPS = [
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
      "marginTop",
      "marginRight",
      "marginBottom",
      "marginLeft",
      "rowGap",
      "columnGap",
    ];
    for (const el of all) {
      const cs = getComputedStyle(el);
      for (const prop of SPACING_PROPS) {
        const raw = cs[prop];
        if (!raw || raw === "normal" || raw === "auto") continue;
        const v = px(raw);
        if (!v || v < 0) continue;
        bump(spacing, v);
        if (v % SPACING_STEP_PX !== 0) bump(offScale, `${v}px (${prop})`);
      }
    }
  
    // ---- アニメーション ---------------------------------------------------------
    const durations = new Map();
    const offBand = [];
    for (const el of all) {
      const cs = getComputedStyle(el);
      const entries = [
        ["transition", toMs(cs.transitionDuration), cs.transitionProperty],
        ["animation", toMs(cs.animationDuration), cs.animationName],
      ];
      for (const [kind, list, what] of entries) {
        for (const ms of list) {
          if (!ms) continue;
          bump(durations, `${kind} ${ms}ms`);
          const inBand = MOTION_BANDS.some(([lo, hi]) => ms >= lo && ms <= hi);
          if (!inBand && offBand.length < 30)
            offBand.push(`${ms}ms ${kind}(${what}) ${describe(el)}`);
        }
      }
    }
  
    // ---- 文字 ---------------------------------------------------------------
    const fontSizes = new Map();
    const fontWeights = new Map();
    for (const el of all) {
      const hasOwnText = [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent.trim(),
      );
      if (!hasOwnText) continue;
      const cs = getComputedStyle(el);
      bump(fontSizes, px(cs.fontSize));
      bump(fontWeights, cs.fontWeight);
    }
  
    // ---- タップ範囲（narrow のときだけ） ------------------------------------------
    const smallTargets = [];
    if (narrow) {
      for (const el of all.filter((e) =>
        e.matches("button, a[href], [role='button'], input, select"),
      )) {
        const r = el.getBoundingClientRect();
        if (
          (r.width < TAP_MIN_PX || r.height < TAP_MIN_PX) &&
          smallTargets.length < 30
        ) {
          smallTargets.push(
            `${Math.round(r.width)}x${Math.round(r.height)} ${describe(el)}`,
          );
        }
      }
    }
  
    return {
      page: {
        url: location.pathname + location.hash,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        theme: document.documentElement.dataset.theme || "system",
        root: ROOT_SELECTOR || "body",
      },
      counts: {
        visibleElements: all.length,
        icons: [...iconNames.values()].reduce((a, b) => a + b, 0),
        iconKinds: iconNames.size,
        iconSizeKinds: iconSizes.size,
        unlabeledIconOnlyControls: unlabeledIconOnly.length,
        spacingValueKinds: spacing.size,
        spacingOffScale: [...offScale.values()].reduce((a, b) => a + b, 0),
        motionDurationKinds: durations.size,
        motionOffBand: offBand.length,
        fontSizeKinds: fontSizes.size,
        smallTapTargets: smallTargets.length,
      },
      icons: {
        byName: toSorted(iconNames),
        bySize: toSorted(iconSizes),
        unlabeledIconOnly,
      },
      spacing: {
        values: toSorted(spacing),
        offScale: toSorted(offScale).slice(0, 30),
      },
      motion: { durations: toSorted(durations), offBand },
      type: {
        fontSizes: toSorted(fontSizes),
        fontWeights: toSorted(fontWeights),
      },
      tap: { narrow, smallTargets },
    };
  }
)
