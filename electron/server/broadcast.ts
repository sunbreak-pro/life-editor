import { EventEmitter } from "events";

export type ChangeAction = "create" | "update" | "delete" | "bulk";

export interface ChangeEvent {
  entity: string;
  action: ChangeAction;
  id?: string | number;
  timestamp: number;
}

export const changeBus = new EventEmitter();
changeBus.setMaxListeners(100);

export function broadcastChange(
  entity: string,
  action: ChangeAction,
  id?: string | number,
): void {
  const event: ChangeEvent = {
    entity,
    action,
    id,
    timestamp: Date.now(),
  };
  changeBus.emit("change", event);
}
