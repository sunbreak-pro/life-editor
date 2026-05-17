// Pattern A barrel (CLAUDE.md §6.3): Provider / Context / ContextValue
// type for every shared Context. Hosts import providers from here.

export { SyncProvider } from "./SyncContext";
export { SyncContext, type WebSyncContextValue } from "./SyncContextValue";

export { TaskTreeProvider } from "./TaskTreeContext";
export {
  TaskTreeContext,
  type TaskTreeContextValue,
} from "./TaskTreeContextValue";

export { DailyProvider } from "./DailyContext";
export { DailyContext, type DailyContextValue } from "./DailyContextValue";

export { NoteProvider } from "./NoteContext";
export { NoteContext, type NoteContextValue } from "./NoteContextValue";
