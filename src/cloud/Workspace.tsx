import { lazy, Suspense } from "react";
const Templates = lazy(() => import("../pages/Templates"));
const TemplatePreview = lazy(() => import("../pages/TemplatePreview"));
import { Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ProjectProvider } from "../state/ProjectContext";
import { ProjectFonts } from "../components/ProjectFonts";
import { CloudProvider, accountProjectKey } from "./CloudContext";
import { emptyProject } from "../model/defaults";
import { Home } from "../pages/Home";
import { Editor } from "../pages/Editor";
import { Preview } from "../pages/Preview";
import { Dashboard } from "../pages/Dashboard";
import { AuthPage } from "../pages/AuthPage";
import { NotFound } from "../pages/NotFound";
export function Workspace() {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <div className="public-loading" role="status">
        Проверяем сессию…
      </div>
    );
  const id = session?.user.id;
  return (
    <ProjectProvider
      key={id ?? "guest"}
      autosave={!location.pathname.startsWith("/templates")}
      storageKey={id ? accountProjectKey(id) : undefined}
      fallbackProject={id ? emptyProject() : undefined}
    >
      {location.pathname !== "/preview" && <ProjectFonts />}
      <CloudProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/templates"
            element={
              <Suspense fallback={<p role="status">Загрузка шаблонов…</p>}>
                <Templates />
              </Suspense>
            }
          />
          <Route
            path="/templates/:id"
            element={
              <Suspense fallback={<p role="status">Загрузка композиции…</p>}>
                <TemplatePreview />
              </Suspense>
            }
          />
          <Route path="/editor" element={<Editor />} />
          <Route path="/preview" element={<Preview />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
          <Route path="/reset-password" element={<AuthPage mode="reset" />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </CloudProvider>
    </ProjectProvider>
  );
}
