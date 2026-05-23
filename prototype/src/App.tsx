export default function App() {
  return (
    <div className="min-h-screen bg-[#1e1e2e] text-[#cdd6f4] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-2">life-editor prototype</h1>
        <p className="text-sm opacity-70">
          Phase 1 — Vite + React + Tailwind v3 ready
        </p>
        <p className="text-xs mt-4 opacity-50">
          Phase 2 で{" "}
          <code className="px-1 bg-[#313244] rounded">/schedule</code>{" "}
          <code className="px-1 bg-[#313244] rounded">/work</code>{" "}
          <code className="px-1 bg-[#313244] rounded">/materials</code>{" "}
          を配置予定
        </p>
      </div>
    </div>
  );
}
