import { useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useTaskTreeContext } from "../../../hooks/useTaskTreeContext";
import { flattenFolders } from "../../../utils/flattenFolders";
import { ConfirmDialog } from "../../shared/ConfirmDialog";
import { STORAGE_KEYS } from "../../../constants/storageKeys";
import { FolderDropdown } from "./FolderDropdown";

interface FolderMovePickerProps {
  currentFolderId: string | null;
  onMove: (newFolderId: string | null) => void;
  trigger: ReactNode;
}

export function FolderMovePicker({
  currentFolderId,
  onMove,
  trigger,
}: FolderMovePickerProps) {
  const { nodes } = useTaskTreeContext();
  const { t } = useTranslation();
  const [pendingFolderId, setPendingFolderId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const folders = flattenFolders(nodes);

  const handleSelect = (folderId: string | null) => {
    if (folderId === currentFolderId) return;

    const skipConfirm =
      localStorage.getItem(STORAGE_KEYS.FOLDER_MOVE_CONFIRM_SKIP) === "true";
    if (skipConfirm) {
      onMove(folderId);
    } else {
      setPendingFolderId(folderId);
      setShowConfirm(true);
    }
  };

  const handleConfirm = () => {
    onMove(pendingFolderId);
    setShowConfirm(false);
  };

  const handleDontShowAgain = (checked: boolean) => {
    localStorage.setItem(
      STORAGE_KEYS.FOLDER_MOVE_CONFIRM_SKIP,
      String(checked),
    );
  };

  const pendingFolderName = pendingFolderId
    ? (folders.find((f) => f.id === pendingFolderId)?.title ?? "Root")
    : t("taskTree.inbox");

  return (
    <>
      <FolderDropdown
        selectedId={currentFolderId}
        onSelect={handleSelect}
        trigger={trigger}
        rootLabel={t("taskTree.inbox")}
      />

      {showConfirm && (
        <ConfirmDialog
          message={t("taskDetailSidebar.moveFolderConfirm", {
            folder: pendingFolderName,
          })}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
          showDontShowAgain
          onDontShowAgainChange={handleDontShowAgain}
        />
      )}
    </>
  );
}
