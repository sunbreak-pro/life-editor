import { useState, useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ScheduleItem } from "../types/schedule";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";

export interface ScheduleItemsEventsResult {
  events: ScheduleItem[];
  eventsVersion: number;
  loadEvents: () => Promise<void>;
  bumpEventsVersion: () => void;
  /** Internal: exposed for Core's applyToLists */
  _setEvents: Dispatch<SetStateAction<ScheduleItem[]>>;
}

export function useScheduleItemsEvents(): ScheduleItemsEventsResult {
  const [events, setEvents] = useState<ScheduleItem[]>([]);
  const [eventsVersion, setEventsVersion] = useState(0);
  const bumpEventsVersion = useCallback(
    () => setEventsVersion((v) => v + 1),
    [],
  );

  const loadEvents = useCallback(async () => {
    try {
      const items = await getDataService().fetchEvents();
      setEvents(items);
    } catch (e) {
      logServiceError("ScheduleItems", "fetchEvents", e);
    }
  }, []);

  return {
    events,
    eventsVersion,
    loadEvents,
    bumpEventsVersion,
    _setEvents: setEvents,
  };
}
