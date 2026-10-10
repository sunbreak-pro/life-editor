import { useEffect, useRef } from "react";

/*
 * 宣言 (intention) input (#391).
 *
 * An auto-growing bare textarea so the declaration reads as ink on the paper,
 * not a form control. Sits on the 朱 side of the accent duo (the user's action
 * voice; Claude's 講評 block is 琥珀).
 *
 * Neither paper carries a 宣言 any more: #2106 dropped the morning one (and
 * the goals block that stacked three of these), #2107 the evening one. Its
 * only mount is the evening paper's 明日の自分へ field (the focus note keyed
 * to tomorrow). Pure presentation (§6.4): no DataService, no useTranslation —
 * the host owns the draft state and the debounced save.
 */
export interface IntentionFieldProps {
  value: string;
  placeholder: string;
  /** Every keystroke — the host owns draft state + debounced persistence. */
  onChange: (text: string) => void;
  /** Blur — the host flushes a pending debounced save. */
  onBlur: () => void;
  /**
   * Id of the heading that names this field (#872). A placeholder is not an
   * accessible name — it disappears on the first character, and screen
   * readers may not announce it at all — so the block heading names it.
   */
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
