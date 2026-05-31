import { Menu, Search } from "lucide-react";
import { C } from "../lib/theme";

/**
 * Global, invariant header (IA v3 — doc 12).
 *
 * Structure never changes across sections/slides; only the centered `title`
 * (current section name) varies. Left = menu (opens the section Drawer),
 * right = search (opens the global cross-cutting SearchOverlay).
 */
export function AppHeader({
  title,
  onMenu,
  onSearch,
}: {
  title: string;
  onMenu: () => void;
  onSearch: () => void;
}) {
  return (
    <header
      className="flex items-center gap-2 px-3 shrink-0"
      style={{
        height: 52,
        background: C.mantle,
        borderBottom: `1px solid ${C.surface0}`,
      }}
    >
      <button
        type="button"
        onClick={onMenu}
        aria-label="メニューを開く"
        className="grid place-items-center rounded"
        style={{ width: 36, height: 36, color: C.text }}
      >
        <Menu size={20} />
      </button>
      <span
        className="text-base font-semibold truncate"
        style={{ color: C.text }}
      >
        {title}
      </span>
      <div className="flex-1" />
      <button
        type="button"
        onClick={onSearch}
        aria-label="横断検索を開く"
        className="grid place-items-center rounded"
        style={{ width: 36, height: 36, color: C.text }}
      >
        <Search size={20} />
      </button>
    </header>
  );
}
