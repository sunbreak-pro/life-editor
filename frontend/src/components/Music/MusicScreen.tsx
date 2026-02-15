import { useTranslation } from "react-i18next";
import { useAudioContext } from "../../hooks/useAudioContext";
import { useSoundTags } from "../../hooks/useSoundTags";
import { SoundTagManager } from "./SoundTagManager";
import { PlaylistDetail } from "./PlaylistDetail";

export function MusicScreen() {
  const audio = useAudioContext();
  const soundTagState = useSoundTags();
  const { t } = useTranslation();

  const selectedPlaylistId = audio.playlistPlayer.activePlaylistId;

  return (
    <div className="h-full flex flex-col overflow-auto">
      <div className="max-w-4xl mx-auto w-full p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-notion-text">
            {t("music.title")}
          </h1>
        </div>

        {/* Sound Tag Manager */}
        <div className="mb-6">
          <SoundTagManager soundTagState={soundTagState} />
        </div>

        {/* Playlist Detail */}
        {selectedPlaylistId && (
          <PlaylistDetail
            playlistId={selectedPlaylistId}
            playlistData={audio.playlistData}
            player={audio.playlistPlayer}
            customSounds={audio.customSounds}
          />
        )}
      </div>
    </div>
  );
}
