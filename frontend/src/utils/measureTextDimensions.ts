interface MeasureOptions {
  text: string;
  minWidth: number;
  minHeight: number;
  maxWidth?: number;
  fontSize?: string;
  lineHeight?: string;
  padding?: number;
}

interface MeasuredSize {
  width: number;
  height: number;
}

/**
 * Measures text dimensions using an offscreen DOM element.
 * Replicates the same CSS as PaperTextNode's rendering container.
 */
export function measureTextDimensions({
  text,
  minWidth,
  minHeight,
  maxWidth = 400,
  fontSize = "12px",
  lineHeight = "1.5",
  padding = 8,
}: MeasureOptions): MeasuredSize {
  const el = document.createElement("div");
  el.style.position = "absolute";
  el.style.visibility = "hidden";
  el.style.whiteSpace = "pre-wrap";
  el.style.wordBreak = "break-words";
  el.style.fontSize = fontSize;
  el.style.lineHeight = lineHeight;
  el.style.fontFamily = "inherit";
  el.style.padding = `${padding}px`;
  el.style.boxSizing = "border-box";
  el.style.maxWidth = `${maxWidth}px`;
  el.style.width = "max-content";
  el.textContent = text || " ";

  document.body.appendChild(el);
  const naturalWidth = el.offsetWidth;
  const naturalHeight = el.offsetHeight;
  document.body.removeChild(el);

  return {
    width: Math.max(minWidth, Math.min(naturalWidth, maxWidth)),
    height: Math.max(minHeight, naturalHeight),
  };
}
