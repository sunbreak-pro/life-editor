import { useState, useEffect, useCallback } from "react";
import { FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getDataService } from "../../services/dataServiceFactory";

export function FilesSettings() {
  const { t } = useTranslation();
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const ds = getDataService();

  useEffect(() => {
    ds.getFilesRootPath().then((p) => {
      setRootPath(p);
      setIsLoading(false);
    });
  }, []);

  const handleBrowse = useCallback(async () => {
    const selected = await ds.selectFolder();
    if (selected) {
      await ds.setAppSetting("files_root_path", selected);
      setRootPath(selected);
    }
  }, [ds]);

  const handleReset = useCallback(async () => {
    await ds.removeAppSetting("files_root_path");
    const defaultPath = await ds.getFilesRootPath();
    setRootPath(defaultPath);
  }, [ds]);

  if (isLoading) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold text-notion-text mb-4">
        {t("files.settingsTitle")}
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-notion-text mb-1">
            {t("files.rootFolder")}
          </label>
          <p className="text-xs text-notion-secondary mb-2">
            {t("files.rootFolderDescription")}
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 text-sm bg-notion-hover rounded-md text-notion-text truncate">
              {rootPath ?? t("files.notConfigured")}
            </div>
            <button
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-notion-primary text-white rounded-md hover:opacity-90"
              onClick={handleBrowse}
            >
              <FolderOpen className="w-4 h-4" />
              {t("files.browse")}
            </button>
          </div>
        </div>

        <div>
          <button
            className="text-xs text-notion-secondary hover:text-notion-text underline"
            onClick={handleReset}
          >
            {t("files.resetToDefault")}
          </button>
        </div>
      </div>
    </div>
  );
}
