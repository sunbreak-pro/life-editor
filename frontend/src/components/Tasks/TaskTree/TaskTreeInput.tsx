import { useState } from "react";
import type { KeyboardEvent } from "react";

interface TaskTreeInputProps {
  onSubmit: (title: string) => void;
  onSubmitFolder?: (title: string) => void;
  allowFolderCreation?: boolean;
  indent?: number;
}

export function TaskTreeInput({
  onSubmit,
  onSubmitFolder,
  allowFolderCreation = false,
  indent = 0,
}: TaskTreeInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setValue("");

    if (allowFolderCreation && trimmed.startsWith("/") && onSubmitFolder) {
      const folderTitle = trimmed.slice(1).trim();
      if (folderTitle) {
        onSubmitFolder(folderTitle);
        return;
      }
    }

    onSubmit(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") setValue("");
  };

  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 text-notion-text-secondary hover:bg-notion-hover rounded-md"
      style={{ paddingLeft: `${indent * 20 + 8}px` }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="flex-1 bg-transparent outline-none text-sm placeholder:text-notion-text-secondary text-notion-text"
      />
    </div>
  );
}
