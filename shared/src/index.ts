export type { DataService } from "./services/DataService";
export { createSupabaseDataService } from "./services/SupabaseDataService";
export {
  signUp,
  signIn,
  signOut,
  getSession,
  onAuthStateChange,
  type AuthResult,
} from "./services/SupabaseAuth";
export type { Session } from "@supabase/supabase-js";

// Types
export type { TaskNode, NodeType, TaskStatus } from "./types/taskTree";
export type { MoveResult, MoveRejectionReason } from "./types/moveResult";
export type { DailyNode } from "./types/daily";

// Tasks domain — context (Pattern A) + hooks
export {
  SyncProvider,
  SyncContext,
  type WebSyncContextValue,
  TaskTreeProvider,
  TaskTreeContext,
  type TaskTreeContextValue,
} from "./context";
export { useTaskTreeContext } from "./hooks/useTaskTreeContext";
export { useSyncContext } from "./hooks/useSyncContext";
export {
  useTaskTreeAPI,
  type UseTaskTreeAPIOptions,
} from "./hooks/useTaskTreeAPI";
export {
  createNoopUndoRedo,
  type UndoRedoLike,
} from "./hooks/useTaskTreeHistory";
export type {
  TaskTreeCRUDConfig,
  AddNodeOptions,
} from "./hooks/useTaskTreeCRUD";

// Daily domain — context (Pattern A) + hook (DI: dataService/undoRedo)
export { DailyProvider } from "./context";
export { DailyContext, type DailyContextValue } from "./context";
export { useDailyContext } from "./hooks/useDailyContext";
export { useDailyAPI, type UseDailyAPIOptions } from "./hooks/useDailyAPI";

// Tasks domain — tree utilities (host UI builds on these)
export {
  getDescendantTasks,
  collectDescendantIds,
  isDescendantOf,
} from "./utils/getDescendantTasks";
export {
  sortTaskNodes,
  type SortMode,
  type SortDirection,
} from "./utils/sortTaskNodes";
export { getFolderTag, truncateFolderTag } from "./utils/folderTag";
