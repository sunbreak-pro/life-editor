import { createOptionalContextHook } from "./createOptionalContextHook";
import { AudioContext } from "../context/AudioContextValue";

/*
 * Optional Audio hook (W3-C). Audio is a Mobile 省略 Provider (CLAUDE.md §2) —
 * NOT mounted on iOS/Android, so consumers MUST use this OPTIONAL variant
 * (returns null when no Provider) and guard for null (vision/coding-
 * principles.md §4). The web/desktop host always mounts the Provider, so its
 * Work tab gets a non-null value.
 */
export const useAudioContext = createOptionalContextHook(AudioContext);
