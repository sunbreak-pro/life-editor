import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { IndexPage } from "./dev/IndexPage";
import { CrossSearchScreen } from "./screens/CrossSearchScreen";
import { MaterialsScreen } from "./screens/MaterialsScreen";
import { ScheduleScreen } from "./screens/ScheduleScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { TrashScreen } from "./screens/TrashScreen";
import { WorkScreen } from "./screens/WorkScreen";

export default function App() {
  return (
    <Routes>
      {/* Dev gateway — intentionally outside the shell (not a "section") */}
      <Route path="/" element={<IndexPage />} />
      {/* All sections share the invariant AppShell chrome (IA v3 — doc 12) */}
      <Route element={<AppShell />}>
        <Route path="/schedule" element={<ScheduleScreen />} />
        <Route path="/work" element={<WorkScreen />} />
        <Route path="/materials" element={<MaterialsScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/trash" element={<TrashScreen />} />
        <Route path="/cross-search" element={<CrossSearchScreen />} />
      </Route>
    </Routes>
  );
}
