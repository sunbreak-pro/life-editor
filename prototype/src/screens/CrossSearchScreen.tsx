import { useSearchParams } from "react-router-dom";
import { CrossSearchBody } from "../components/CrossSearchBody";
import { Drawer } from "../components/Drawer";
import { useShell } from "../context/ShellContext";
import { C } from "../lib/theme";

/**
 * /cross-search page — a thin wrapper around the shared CrossSearchBody
 * (query + kind/tag chips + result list live there now). The page only wires
 * the ?tag= deep-link and the section Drawer; the persistent AppHeader provides
 * menu/title/search.
 */
export function CrossSearchScreen() {
  const { sidebarOpen, closeSidebar } = useShell();
  const [params] = useSearchParams();
  const initialTag = params.get("tag");
  return (
    <div
      className="flex h-full flex-col"
      style={{ background: C.base, color: C.text }}
    >
      <div className="min-h-0 flex-1">
        <CrossSearchBody initialTag={initialTag} />
      </div>
      <Drawer open={sidebarOpen} onClose={closeSidebar} title="横断検索">
        <div
          className="flex-1 overflow-y-auto p-3 text-sm"
          style={{ color: C.subtext0 }}
        >
          タグ・タイトル・本文で予定とノートを横断検索できます。
        </div>
      </Drawer>
    </div>
  );
}
