import { AudioContext } from "../context/AudioContextValue";
import { createOptionalContextHook } from "./createOptionalContextHook";

export const useAudioContextOptional = createOptionalContextHook(AudioContext);
