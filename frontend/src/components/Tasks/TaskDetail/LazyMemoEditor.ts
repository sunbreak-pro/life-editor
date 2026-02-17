import { lazy } from "react";

export const LazyMemoEditor = lazy(() =>
  import("./MemoEditor").then((m) => ({ default: m.MemoEditor })),
);
