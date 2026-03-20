import { ipcMain } from "electron";
import log from "../logger";
import { broadcastChange } from "../server/broadcast";
import type { ChangeAction } from "../server/broadcast";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HandlerFn = (...args: any[]) => any;

export function loggedHandler(
  domain: string,
  name: string,
  fn: HandlerFn,
): HandlerFn {
  return (...args) => {
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        return result.catch((e: unknown) => {
          log.error(`[${domain}] ${name} failed:`, e);
          throw e;
        });
      }
      return result;
    } catch (e) {
      log.error(`[${domain}] ${name} failed:`, e);
      throw e;
    }
  };
}

/** Register a read-only IPC handler (no broadcast). */
export function query(
  channel: string,
  domain: string,
  name: string,
  fn: HandlerFn,
): void {
  ipcMain.handle(channel, loggedHandler(domain, name, fn));
}

/**
 * Register a mutating IPC handler that broadcasts a change event.
 * By default, `args[1]` (first arg after IpcMainInvokeEvent) is used as the broadcast id.
 * Pass a custom `getBroadcastId` to override (e.g. extract id from result).
 */
export function mutation(
  channel: string,
  domain: string,
  name: string,
  entityType: string,
  action: ChangeAction,
  fn: HandlerFn,
  getBroadcastId?: (
    args: unknown[],
    result: unknown,
  ) => string | number | undefined,
): void {
  ipcMain.handle(
    channel,
    loggedHandler(domain, name, (...args) => {
      const result = fn(...args);
      const id = getBroadcastId
        ? getBroadcastId(args, result)
        : (args[1] as string | undefined);
      broadcastChange(entityType, action, id);
      return result;
    }),
  );
}
