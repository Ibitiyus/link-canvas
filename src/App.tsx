import { lazy, Suspense } from "react";
const Explore = lazy(() => import("./pages/Explore"));
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { RouteIndexing } from "./explore/RouteIndexing";
import { AuthProvider } from "./auth/AuthContext";
import { Workspace } from "./cloud/Workspace";
import { PublicPage } from "./pages/PublicPage";
export function App() {
  return (
    <BrowserRouter>
      <RouteIndexing />
      <AuthProvider>
        <Routes>
          <Route
            path="/explore"
            element={
              <Suspense fallback={<p role="status">Загрузка галереи…</p>}>
                <Explore />
              </Suspense>
            }
          />
          <Route path="/u/:username" element={<PublicPage />} />
          <Route path="*" element={<Workspace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
