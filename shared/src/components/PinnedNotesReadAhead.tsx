import { useEffect, useRef, useState } from "react";
import { useDomainLoad } from "../hooks/useDomainLoad";
import type { DataService } from "../services/DataService";
import type { NoteNode } from "../types/note";
import { isDomainSnapshotRead } from "../state/domainSnapshotStore";
import { syncPinnedNoteBodies } from "../state/noteBodyStore";

/*
 * Reads the Notes list once per session whatever screen is open (#2334, plan P1c
 * step 5). What was pinned on another device has to open offline here, and the
 * Notes provider is mounted only while the Notes tab is. This read also stores
 * the list itself, which the offline Notes tab needs as much as the bodies.
 *
 * Draws nothing. It starts late so it never competes with the first screen's own
 * reads, skips itself when the Notes tab has already read in this page (that read
 * keeps the bodies in line too), and goes through `useDomainLoad`, so it shares
 * the Notes slot, reads only changes when a cursor is stored, and waits out being
 * offline. It does not follow Sync bumps: the Notes tab does that while it is open.
 */

/** Long enough for the first screen's reads to go first. */
const READ_AHEAD_DELAY_MS = 3_000;

function Reader({ dataService }: { dataService: DataService }): null {
  // The replay at mount says nothing new about what is pinned. A read does.
  const landedRef = useRef(false);
  useDomainLoad<NoteNode[]>({
    domain: "NotesReadAhead",
    snapshotKey: "notes",
    dataService,
    version: 0,
    load: async (service) => {
      const rows = await service.listNotesUnified();
      landedRef.current = true;
      return rows;
    },
    delta: {
      readCursor: (service) => service.readItemChangeCursor(),
      read: async (service, cursor, base) => {
        const read = await service.fetchNoteChanges(cursor, base);
        if (read !== null) landedRef.current = true;
        return read;
      },
    },
    apply: (rows) => {
      if (landedRef.current)
        void syncPinnedNoteBodies(rows, (id) =>
          dataService.getNoteUnified(id),
        );
    },
    fallbackMessage: "Failed to read notes ahead",
  });
  return null;
}

export function PinnedNotesReadAhead({
  dataService,
  delayMs = READ_AHEAD_DELAY_MS,
}: {
  dataService: DataService;
  delayMs?: number;
}): React.JSX.Element | null {
  const [due, setDue] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isDomainSnapshotRead("notes", dataService)) setDue(true);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [dataService, delayMs]);
  return due ? <Reader dataService={dataService} /> : null;
}
