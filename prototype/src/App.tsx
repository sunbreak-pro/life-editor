import { Route, Routes } from "react-router-dom";
import { IndexPage } from "./dev/IndexPage";
import { MaterialsScreen } from "./screens/MaterialsScreen";
import { ScheduleScreen } from "./screens/ScheduleScreen";
import { WorkScreen } from "./screens/WorkScreen";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<IndexPage />} />
      <Route path="/schedule" element={<ScheduleScreen />} />
      <Route path="/work" element={<WorkScreen />} />
      <Route path="/materials" element={<MaterialsScreen />} />
    </Routes>
  );
}
