import { createOptionalContextHook } from "./createOptionalContextHook";
import { AudioContext } from "../context/AudioContextValue";

/*
 * Optional Audio hook (W3-C). The web host mounts AudioProvider on EVERY
 * platform, native shells included (#320 — the completion chime is part of the
 * Mobile-Full work timer, mobile-scope.md #10; only the ambient-mixer UI is
 * native-omitted). The hook still returns null outside a Provider, and
 * consumers MUST keep the null guard (vision/coding-principles.md §4) so any
 * host that does omit the Provider stays crash-free.
 */
export const useAudioContext = createOptionalContextHook(AudioContext);
