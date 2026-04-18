import { ScreenLockContext } from "../context/ScreenLockContextValue";
import { createOptionalContextHook } from "./createOptionalContextHook";

export const useScreenLockContextOptional =
  createOptionalContextHook(ScreenLockContext);
