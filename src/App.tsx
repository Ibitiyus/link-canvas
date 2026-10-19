import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { ProjectProvider } from "./state/ProjectContext";
import { Home } from "./pages/Home";
import { Editor } from "./pages/Editor";
import { Preview } from "./pages/Preview";
export function App() {
  return (
    <BrowserRouter>
      <ProjectProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/editor" element={<Editor />} />
          <Route path="/preview" element={<Preview />} />
          <Route
            path="*"
            element={
              <main className="not-found">
                <h1>Страница не найдена</h1>
                <Link className="primary-button" to="/editor">
                  Открыть редактор
                </Link>
              </main>
            }
          />
        </Routes>
      </ProjectProvider>
    </BrowserRouter>
  );
}
