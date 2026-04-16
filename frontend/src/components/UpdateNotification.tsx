import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { getDataService } from "../services";
import { onUpdaterStatus } from "../services/events";
import type { UpdaterStatus } from "../types/updater";

export function UpdateNotification() {
  const [status, setStatus] = useState<UpdaterStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    onUpdaterStatus((s: UpdaterStatus) => {
      setStatus(s);
      if (s.event === "available" || s.event === "downloaded") {
        setDismissed(false);
      }
    }).then((unlisten) => {
      if (disposed) {
        unlisten();
      } else {
        cleanup = unlisten;
      }
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  const handleDownload = useCallback(async () => {
    await getDataService().downloadUpdate();
  }, []);

  const handleInstall = useCallback(async () => {
    await getDataService().installUpdate();
  }, []);

  if (dismissed || !status) return null;

  if (status.event === "available") {
    return (
      <div className="bg-notion-primary/10 border-b border-notion-primary/20 px-4 py-2 flex items-center gap-3 text-sm">
        <span className="text-notion-text flex-1">
          Update v{status.data?.version} is available.
        </span>
        <button
          onClick={handleDownload}
          className="px-3 py-1 rounded text-xs font-medium bg-notion-primary text-white hover:opacity-90 transition-opacity"
        >
          Update Now
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-notion-text-secondary hover:text-notion-text transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  if (status.event === "downloaded") {
    return (
      <div className="bg-green-500/10 border-b border-green-500/20 px-4 py-2 flex items-center gap-3 text-sm">
        <span className="text-notion-text flex-1">
          Update ready. Restart to apply v{status.data?.version}.
        </span>
        <button
          onClick={handleInstall}
          className="px-3 py-1 rounded text-xs font-medium bg-green-600 text-white hover:opacity-90 transition-opacity"
        >
          Restart Now
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-notion-text-secondary hover:text-notion-text transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return null;
}
