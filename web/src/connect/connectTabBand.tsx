import type { HeaderTab } from "@life-editor/shared";
import type { TabBand } from "../MainScreen";
import type { ConnectTab } from "../hooks/useShellNavigation";

/**
 * Connect's header band: タグ / 目標と Todo (#2108). Built here rather than
 * inline in MainScreen so web/tests/connectTabs.test.tsx renders the very band
 * the shell does.
 *
 * #2224 took the tag hub's "tags N / items N" off the band's trailing slot
 * (the Claude Design prototype drops it): the rail already counts each tag,
 * and the header's selected-tag line counts what is open.
 */
export function connectTabBand({
  defs,
  active,
  onSelect,
  label,
}: {
  defs: HeaderTab[];
  active: ConnectTab;
  onSelect: (tab: ConnectTab) => void;
  label: string;
}): TabBand {
  return {
    defs,
    active,
    onSelect: (id) => onSelect(id as ConnectTab),
    label,
  };
}
