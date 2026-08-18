import { useEffect, useState } from "react";

/*
 * "Is this the first time this key has been shown?" (#1049)
 *
 * The entrance animation it gates has two halves to its brief, and the second
 * one is why this is a hook rather than a bare CSS class: the motion should
 * land when a surface first arrives, and it must NOT replay every time you
 * switch back and forth. A class keyed on the section id alone would fire on
 * every switch, which is the 煩わしい the Issue rules out.
 *
 * So each key animates once per mount of whatever owns the hook — a session,
 * in practice, since the shell mounts once. briefing → schedule → briefing
 * animates schedule and leaves briefing alone the second time.
 *
 * TWO THINGS ARE LOAD-BEARING, and both are about not cutting the animation
 * short:
 *
 * - THE ANSWER IS HELD IN STATE, keyed, and only recomputed when `key` itself
 *   changes. Deriving it fresh on every render would flip it to false the
 *   moment anything else re-rendered — a fetch landing, a toast — and the
 *   class would be pulled off an element mid-fade, snapping it into place.
 *   Sections re-render constantly, so this is the common case, not the edge.
 *   Assigning during render is React's documented "adjust state when a prop
 *   changes" path: the render output is discarded and re-run immediately, no
 *   extra commit.
 *
 * - THE MARK IS SET IN AN EFFECT, not during render. Marking while rendering
 *   would make the render impure, and under StrictMode's double render the
 *   throwaway pass would consume the "first" — the committed pass would come
 *   back false and nothing would animate in dev (#505 is the same shape).
 *   Effects run after commit, so both passes agree and the mark lands once.
 *
 * A consequence worth knowing: the answer stays true for as long as you remain
 * on that key, so a caller's class stays applied after the animation ends.
 * That is deliberate — see above — and harmless for a fill-mode `both`
 * animation, whose final frame is the element's resting state anyway.
 */
export function useFirstAppearance(key: string): boolean {
  const [seen] = useState(() => new Set<string>());
  // The set is empty at mount, so the very first key is always a first.
  const [current, setCurrent] = useState(() => ({ key, first: true }));

  if (current.key !== key) setCurrent({ key, first: !seen.has(key) });

  useEffect(() => {
    seen.add(key);
  }, [key, seen]);

  // On the render that just re-keyed, `current` is still the old answer and
  // React is about to re-run this — compute the right one rather than letting
  // a stale `true` escape if that ever stops holding.
  return current.key === key ? current.first : !seen.has(key);
}
