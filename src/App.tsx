import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { Workspace } from "./cloud/Workspace";
import { PublicPage } from "./pages/PublicPage";
export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/u/:username" element={<PublicPage />} />
          <Route path="*" element={<Workspace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
