import { ScreenLockContext } from "../context/ScreenLockContextValue";
import { createContextHook } from "./createContextHook";

export const useScreenLockContext = createContextHook(
  ScreenLockContext,
  "useScreenLockContext",
);
