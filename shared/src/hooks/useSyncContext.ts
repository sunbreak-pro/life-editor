import { SyncContext } from "../context/SyncContextValue";
import { createContextHook } from "./createContextHook";

export const useSyncContext = createContextHook(SyncContext, "useSyncContext");
