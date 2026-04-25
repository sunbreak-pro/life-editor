import { useCallback, useRef, useState } from "react";

export interface SectionHistory<TSection extends string> {
  current: TSection;
  push: (next: TSection) => void;
  goBack: () => void;
  canGoBack: boolean;
  reset: (section: TSection) => void;
}

export function useSectionHistory<TSection extends string>(
  initial: TSection,
): SectionHistory<TSection> {
  const [current, setCurrent] = useState<TSection>(initial);
  const stackRef = useRef<TSection[]>([]);
  const [canGoBack, setCanGoBack] = useState(false);

  const push = useCallback(
    (next: TSection) => {
      if (next === current) return;
      stackRef.current.push(current);
      setCurrent(next);
      setCanGoBack(stackRef.current.length > 0);
    },
    [current],
  );

  const goBack = useCallback(() => {
    const prev = stackRef.current.pop();
    if (prev === undefined) return;
    setCurrent(prev);
    setCanGoBack(stackRef.current.length > 0);
  }, []);

  const reset = useCallback((section: TSection) => {
    stackRef.current = [];
    setCurrent(section);
    setCanGoBack(false);
  }, []);

  return { current, push, goBack, canGoBack, reset };
}
