import { useCallback, useEffect, useState } from "react";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import type { BacklinkHit, UnlinkedMention } from "../types/noteLink";
import { useSyncContext } from "./useSyncContext";

export interface UseBacklinksResult {
  backlinks: BacklinkHit[];
  unlinked: UnlinkedMention[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useBacklinks(noteId: string | null): UseBacklinksResult {
  const { syncVersion } = useSyncContext();
  const [backlinks, setBacklinks] = useState<BacklinkHit[]>([]);
  const [unlinked, setUnlinked] = useState<UnlinkedMention[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!noteId) {
      setBacklinks([]);
      setUnlinked([]);
      return;
    }
    setLoading(true);
    try {
      const ds = getDataService();
      const [bk, un] = await Promise.all([
        ds.fetchBacklinksForNote(noteId),
        ds.fetchUnlinkedMentions(noteId),
      ]);
      setBacklinks(bk);
      setUnlinked(un);
    } catch (err) {
      logServiceError("useBacklinks", "refresh", err);
      setBacklinks([]);
      setUnlinked([]);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    void refresh();
  }, [refresh, syncVersion]);

  return { backlinks, unlinked, loading, refresh };
}
