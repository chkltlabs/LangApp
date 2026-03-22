import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ChatPage } from "./pages/ChatPage";
import { ExercisePage } from "./pages/ExercisePage";
import { PronouncePage } from "./pages/PronouncePage";
import { SrsPage } from "./pages/SrsPage";
import { VoicePage } from "./pages/VoicePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<ChatPage />} />
          <Route path="voice" element={<VoicePage />} />
          <Route path="srs" element={<SrsPage />} />
          <Route path="exercises" element={<ExercisePage />} />
          <Route path="pronounce" element={<PronouncePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
