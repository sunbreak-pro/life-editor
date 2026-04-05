import { createContext } from "react";
import type { useMemos } from "../hooks/useMemos";

export type MemoContextValue = ReturnType<typeof useMemos>;

export const MemoContext = createContext<MemoContextValue | null>(null);
