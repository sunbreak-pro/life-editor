import { useCallback } from "react";

const AUDIO_ACCEPT = "audio/mp3,audio/wav,audio/ogg,audio/mpeg,.mp3,.wav,.ogg";

export function useAudioFileUpload(
  addSound: (file: File) => Promise<unknown>,
): () => void {
  return useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = AUDIO_ACCEPT;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        await addSound(file);
      }
    };
    input.click();
  }, [addSound]);
}
