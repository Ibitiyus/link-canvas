import { Route, Routes } from "react-router-dom";
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
      storageKey={id ? accountProjectKey(id) : undefined}
      fallbackProject={id ? emptyProject() : undefined}
    >
      <ProjectFonts />
      <CloudProvider>
        <Routes>
          <Route path="/" element={<Home />} />
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
