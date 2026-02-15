import { AudioContext } from "../context/AudioContextValue";
import { createContextHook } from "./createContextHook";

export const useAudioContext = createContextHook(
  AudioContext,
  "useAudioContext",
);
