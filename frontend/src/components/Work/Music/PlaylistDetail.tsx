import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { KeyboardEvent } from "react";
import {
  Plus,
  GripVertical,
  X,
  Music,
  Play,
  Pencil,
  Check,
  ChevronLeft,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SOUND_TYPES } from "../../../constants/sounds";
import { SoundTagEditor } from "./SoundTagEditor";
import { useSoundTags } from "../../../hooks/useSoundTags";
import { useAudioContext } from "../../../hooks/useAudioContext";
import type { PlaylistDataResult } from "../../../hooks/usePlaylistData";
import type { PlaylistPlayerResult } from "../../../hooks/usePlaylistPlayer";
import type { PlaylistItem } from "../../../types/playlist";
import type { CustomSoundMeta } from "../../../types/customSound";

interface PlaylistDetailProps {
  playlistId: string;
  playlistData: PlaylistDataResult;
  player: PlaylistPlayerResult;
  customSounds: CustomSoundMeta[];
  onBack: () => void;
  onRequestAddMode: () => void;
}

function getSoundLabel(
  soundId: string,
  customSounds: CustomSoundMeta[],
  getDisplayName: (soundId: string) => string | undefined,
): string {
  const displayName = getDisplayName(soundId);
  if (displayName) return displayName;
  const builtIn = SOUND_TYPES.find((s) => s.id === soundId);
  if (builtIn) return builtIn.label;
  const custom = customSounds.find((s) => s.id === soundId);
  if (custom) return custom.label;
  return soundId;
}

interface SortableItemProps {
  item: PlaylistItem;
  label: string;
  soundId: string;
  isCurrentTrack: boolean;
  soundTagState: ReturnType<typeof useSoundTags>;
  onRemove: () => void;
  onPlay: () => void;
  onUpdateLabel?: (soundId: string, label: string) => void;
}

function SortableItem({
  item,
  label,
  soundId,
  isCurrentTrack,
  soundTagState,
  onRemove,
  onPlay,
  onUpdateLabel,
}: SortableItemProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed) {
      soundTagState.updateDisplayName(soundId, trimmed);
      if (onUpdateLabel) onUpdateLabel(soundId, trimmed);
    }
    setIsEditing(false);
  }, [editValue, soundId, soundTagState, onUpdateLabel]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setEditValue(label);
      setIsEditing(false);
    }
  };

  const currentTags = soundTagState.getTagsForSound(soundId);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md group transition-colors ${
        isCurrentTrack ? "bg-notion-accent/10" : "hover:bg-notion-hover"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="p-0.5 text-notion-text-secondary cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={12} />
      </button>

      <button
        onClick={onPlay}
        className="p-0.5 text-notion-text-secondary hover:text-notion-accent transition-colors"
      >
        {isCurrentTrack ? (
          <Music size={13} className="text-notion-accent" />
        ) : (
          <Play size={13} />
        )}
      </button>

      {isEditing ? (
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="text-sm bg-transparent outline-none border-b border-notion-accent text-notion-text flex-1 min-w-0"
          />
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="p-0.5 text-notion-accent hover:text-green-500 transition-colors shrink-0"
          >
            <Check size={12} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span
            onClick={() => {
              setEditValue(label);
              setIsEditing(true);
            }}
            className={`text-sm truncate cursor-text ${
              isCurrentTrack
                ? "text-notion-accent font-medium"
                : "text-notion-text"
            }`}
            title={label}
          >
            {label}
          </span>
          {currentTags.length > 0 && (
            <div className="flex items-center gap-0.5 shrink-0">
              {currentTags.slice(0, 3).map((tag) => (
                <span
                  key={tag.id}
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                  title={tag.name}
                />
              ))}
              {currentTags.length > 3 && (
                <span className="text-[9px] text-notion-text-secondary">
                  +{currentTags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isEditing && (
          <button
            onClick={() => {
              setEditValue(label);
              setIsEditing(true);
            }}
            className="p-0.5 text-notion-text-secondary hover:text-notion-text transition-colors"
            title={t("music.editName")}
          >
            <Pencil size={11} />
          </button>
        )}
        <div className="relative shrink-0">
          <SoundTagEditor
            soundId={soundId}
            soundTagState={soundTagState}
            hidePills
          />
        </div>
        <button
          onClick={onRemove}
          className="p-0.5 text-notion-text-secondary hover:text-red-500 transition-opacity"
          title={t("playlist.removeFromPlaylist")}
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

export function PlaylistDetail({
  playlistId,
  playlistData,
  player,
  customSounds,
  onBack,
  onRequestAddMode,
}: PlaylistDetailProps) {
  const { t } = useTranslation();
  const audio = useAudioContext();
  const soundTagState = useSoundTags();

  const items = useMemo(
    () => playlistData.itemsByPlaylist[playlistId] || [],
    [playlistData.itemsByPlaylist, playlistId],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const currentTrackItem =
    player.activePlaylistId === playlistId
      ? player.activePlaylistItems[player.currentTrackIndex]
      : null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(items, oldIndex, newIndex);
    playlistData.reorderItems(
      playlistId,
      newOrder.map((i) => i.id),
    );
  };

  const playlist = playlistData.playlists.find((p) => p.id === playlistId);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            onClick={onBack}
            className="p-1 text-notion-text-secondary hover:text-notion-text rounded-md hover:bg-notion-hover transition-colors"
            title={t("playlist.back")}
          >
            <ChevronLeft size={16} />
          </button>
          <h3 className="text-sm font-medium text-notion-text">
            {playlist?.name || t("playlist.tracks")}
          </h3>
        </div>
        <button
          onClick={onRequestAddMode}
          className="flex items-center gap-1 px-2 py-1 text-xs text-notion-text-secondary hover:text-notion-accent rounded-md hover:bg-notion-hover transition-colors"
        >
          <Plus size={12} />
          {t("playlist.addTrack")}
        </button>
      </div>

      {items.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-0.5">
              {items.map((item, index) => (
                <SortableItem
                  key={item.id}
                  item={item}
                  soundId={item.soundId}
                  label={getSoundLabel(
                    item.soundId,
                    customSounds,
                    soundTagState.getDisplayName,
                  )}
                  isCurrentTrack={currentTrackItem?.id === item.id}
                  soundTagState={soundTagState}
                  onUpdateLabel={(soundId, label) => {
                    if (soundId.startsWith("custom-")) {
                      audio.updateCustomSoundLabel(soundId, label);
                    }
                  }}
                  onRemove={() => playlistData.removeItem(playlistId, item.id)}
                  onPlay={() => {
                    if (player.activePlaylistId !== playlistId) {
                      player.setActivePlaylistId(playlistId);
                    }
                    player.jumpToTrack(index);
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="text-center py-8 text-sm text-notion-text-secondary">
          {t("playlist.noTracks")}
        </div>
      )}
    </div>
  );
}
