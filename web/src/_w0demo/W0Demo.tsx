import { useState } from "react";
import { Trash2, Plus, Settings } from "lucide-react";
import {
  Button,
  IconButton,
  Input,
  Card,
  Modal,
  BottomSheet,
} from "@life-editor/shared";

/*
 * THROWAWAY W0 verification screen — delete after W0 sign-off.
 *
 * Mounts every shared design-system primitive so the notion-* tokens and
 * Tailwind `@source` scan of shared/src can be eyeballed in the browser.
 * Reach it at `/?w0demo` (see main.tsx). Does NOT touch the real lean UI.
 */
export function W0Demo() {
  const [dark, setDark] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [text, setText] = useState("");

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
  };

  return (
    <div className="min-h-screen bg-notion-bg p-8 text-notion-text">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">W0 Design System Demo</h1>
          <Button variant="secondary" size="sm" onClick={toggleTheme}>
            {dark ? "Light theme" : "Dark theme"}
          </Button>
        </div>

        <Card>
          <h2 className="mb-3 text-sm font-medium text-notion-text-secondary">
            Buttons
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" leadingIcon={<Plus size={14} />}>
              Primary
            </Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger" leadingIcon={<Trash2 size={14} />}>
              Danger
            </Button>
            <Button disabled>Disabled</Button>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium text-notion-text-secondary">
            Icon buttons
          </h2>
          <div className="flex gap-2">
            <IconButton icon={<Settings size={16} />} label="Settings" />
            <IconButton
              icon={<Plus size={16} />}
              label="Add"
              variant="solid"
            />
            <IconButton
              icon={<Trash2 size={16} />}
              label="Delete"
              variant="danger"
            />
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium text-notion-text-secondary">
            Input
          </h2>
          <div className="flex flex-col gap-3">
            <Input
              placeholder="Normal input"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Input placeholder="Invalid input" invalid />
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium text-notion-text-secondary">
            Overlays
          </h2>
          <div className="flex gap-2">
            <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>
              Open BottomSheet
            </Button>
          </div>
        </Card>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Example Modal"
      >
        <p className="text-sm text-notion-text-secondary">
          Opaque panel over a dimmed backdrop. Press Escape or click outside
          to close.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => setModalOpen(false)}>Confirm</Button>
        </div>
      </Modal>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Example Sheet"
      >
        <p className="text-sm text-notion-text-secondary">
          Tap-friendly sheet for the mobile split path of the 2-layer model.
        </p>
        <Button className="mt-4 w-full" onClick={() => setSheetOpen(false)}>
          Done
        </Button>
      </BottomSheet>
    </div>
  );
}
