import { useState, useRef, useEffect, useCallback } from "react";
import type { KeyboardEvent } from "react";
import { Trash2, Pencil, Check, Play, Pause } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAudioContext } from "../../../hooks/useAudioContext";
import { SoundTagEditor } from "./SoundTagEditor";
import { SOUND_TYPES } from "../../../constants/sounds";
import type { useSoundTags } from "../../../hooks/useSoundTags";

interface MusicSoundItemProps {
  soundId: string;
  defaultLabel: string;
  isCustom: boolean;
  soundTagState: ReturnType<typeof useSoundTags>;
  previewingId: string | null;
  onTogglePreview: (soundId: string, url: string) => void;
  isAddMode?: boolean;
  isChecked?: boolean;
  isAlreadyInPlaylist?: boolean;
  onToggleCheck?: (soundId: string) => void;
}

export function MusicSoundItem({
  soundId,
  defaultLabel,
  isCustom,
  soundTagState,
  previewingId,
  onTogglePreview,
  isAddMode = false,
  isChecked = false,
  isAlreadyInPlaylist = false,
  onToggleCheck,
}: MusicSoundItemProps) {
  const { t } = useTranslation();
  const audio = useAudioContext();
  const isPreviewing = previewingId === soundId;

  const displayName = soundTagState.getDisplayName(soundId) || defaultLabel;
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(displayName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const [showSaved, setShowSaved] = useState(false);

  const handleSave = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed) {
      soundTagState.updateDisplayName(soundId, trimmed);
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 1500);
    }
    setIsEditing(false);
  }, [editValue, soundId, soundTagState]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setEditValue(displayName);
      setIsEditing(false);
    }
  };

  const currentTags = soundTagState.getTagsForSound(soundId);
  const soundUrl =
    audio.soundSources[soundId] ||
    SOUND_TYPES.find((s) => s.id === soundId)?.file ||
    "";

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-notion-hover group ${
        isAddMode && isAlreadyInPlaylist ? "opacity-50" : ""
      }`}
      onClick={
        isAddMode && !isAlreadyInPlaylist
          ? () => onToggleCheck?.(soundId)
          : undefined
      }
    >
      {/* Add mode checkbox */}
      {isAddMode && (
        <input
          type="checkbox"
          checked={isChecked}
          disabled={isAlreadyInPlaylist}
          onChange={() => onToggleCheck?.(soundId)}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 shrink-0 accent-[--color-accent] cursor-pointer disabled:cursor-not-allowed"
        />
      )}

      {/* Play/Preview button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onTogglePreview(soundId, soundUrl);
        }}
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
          isPreviewing
            ? "bg-notion-accent text-white"
            : "bg-notion-hover text-notion-text-secondary hover:text-notion-text hover:bg-notion-accent/20"
        }`}
      >
        {isPreviewing ? (
          <Pause size={14} />
        ) : (
          <Play size={14} className="ml-0.5" />
        )}
      </button>

      {/* Name + tag dots */}
      {isEditing ? (
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="text-sm font-medium bg-transparent outline-none border-b border-notion-accent text-notion-text flex-1 min-w-0"
          />
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="p-0.5 text-notion-accent hover:text-green-500 transition-colors shrink-0"
          >
            <Check size={14} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span
            className="text-sm truncate text-notion-text"
            title={displayName}
          >
            {displayName}
          </span>
          {showSaved && (
            <span className="text-xs text-green-500 font-medium shrink-0">
              &#10003;
            </span>
          )}
          {/* Tag dots */}
          {currentTags.length > 0 && (
            <div className="flex items-center gap-0.5 shrink-0">
              {currentTags.slice(0, 4).map((tag) => (
                <span
                  key={tag.id}
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                  title={tag.name}
                />
              ))}
              {currentTags.length > 4 && (
                <span className="text-[9px] text-notion-text-secondary">
                  +{currentTags.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Hover-only action buttons */}
      <div className="flex items-center gap-0.5 shrink-0 transition-opacity opacity-0 group-hover:opacity-100">
        {/* Edit name */}
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="p-1 rounded text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover transition-colors"
            title={t("music.editName")}
          >
            <Pencil size={14} />
          </button>
        )}

        {/* Tag editor */}
        <div className="relative shrink-0">
          <SoundTagEditor
            soundId={soundId}
            soundTagState={soundTagState}
            hidePills
          />
        </div>

        {/* Delete (custom only) */}
        {isCustom && (
          <button
            onClick={() => audio.removeSound(soundId)}
            className="p-1 rounded text-notion-text-secondary hover:text-notion-danger hover:bg-notion-hover transition-colors"
            title={t("common.delete")}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
