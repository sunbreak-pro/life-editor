/*
 * Phase 1 scaffold verification screen.
 * Renders a few notion-* token classes so the Tailwind v4 setup can be
 * visually confirmed. Real UI (Tasks etc.) is ported in Phase 2.
 */
function App() {
  return (
    <div className="min-h-screen bg-notion-bg text-notion-text p-8">
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold text-notion-text">
          Life Editor — Web (Phase 1 scaffold)
        </h1>
        <p className="text-notion-text-secondary">
          Tailwind v4 + notion-* token check. If the colors below render
          correctly, the scaffold is wired up.
        </p>

        <div className="rounded-md border border-notion-border bg-notion-bg-secondary p-4">
          <p className="text-notion-text">
            <span className="font-medium">bg-notion-bg-secondary</span> panel
            with <span className="text-notion-accent">notion-accent</span> text.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            className="rounded-md bg-notion-accent px-4 py-2 text-white hover:opacity-90"
          >
            Accent button
          </button>
          <button
            type="button"
            className="rounded-md border border-notion-border px-4 py-2 text-notion-text hover:bg-notion-hover"
          >
            Hover token
          </button>
        </div>

        <p className="text-notion-success">notion-success color sample</p>
        <p className="text-notion-danger">notion-danger color sample</p>
      </div>
    </div>
  );
}

export default App;
