import { useState, useMemo } from "react";
import { Plus, GripVertical, Trash2, Music, Play } from "lucide-react";
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
import { SOUND_TYPES } from "../../constants/sounds";
import { SoundPickerModal } from "./SoundPickerModal";
import { useSoundTags } from "../../hooks/useSoundTags";
import type { PlaylistDataResult } from "../../hooks/usePlaylistData";
import type { PlaylistPlayerResult } from "../../hooks/usePlaylistPlayer";
import type { PlaylistItem } from "../../types/playlist";
import type { CustomSoundMeta } from "../../types/customSound";

interface PlaylistDetailProps {
  playlistId: string;
  playlistData: PlaylistDataResult;
  player: PlaylistPlayerResult;
  customSounds: CustomSoundMeta[];
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
  isCurrentTrack: boolean;
  onRemove: () => void;
  onPlay: () => void;
}

function SortableItem({
  item,
  label,
  isCurrentTrack,
  onRemove,
  onPlay,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

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

      <span
        className={`text-sm truncate flex-1 ${
          isCurrentTrack ? "text-notion-accent font-medium" : "text-notion-text"
        }`}
      >
        {label}
      </span>

      <button
        onClick={onRemove}
        className="p-0.5 text-notion-text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

export function PlaylistDetail({
  playlistId,
  playlistData,
  player,
  customSounds,
}: PlaylistDetailProps) {
  const { t } = useTranslation();
  const soundTagState = useSoundTags();
  const [pickerOpen, setPickerOpen] = useState(false);

  const items = useMemo(
    () => playlistData.itemsByPlaylist[playlistId] || [],
    [playlistData.itemsByPlaylist, playlistId],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const existingSoundIds = useMemo(() => items.map((i) => i.soundId), [items]);

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

  const handleAddSound = (soundId: string) => {
    playlistData.addItem(playlistId, soundId);
  };

  const handleAddCustomSound = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/mp3,audio/wav,audio/ogg,audio/mpeg,.mp3,.wav,.ogg";
    input.click();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-notion-text">
          {t("playlist.tracks")}
        </h3>
        <button
          onClick={() => setPickerOpen(true)}
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
                  label={getSoundLabel(
                    item.soundId,
                    customSounds,
                    soundTagState.getDisplayName,
                  )}
                  isCurrentTrack={currentTrackItem?.id === item.id}
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

      <SoundPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelectSound={handleAddSound}
        excludeSoundIds={existingSoundIds}
        customSounds={customSounds}
        onAddCustomSound={handleAddCustomSound}
        soundTagState={soundTagState}
      />
    </div>
  );
}
