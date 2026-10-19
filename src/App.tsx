import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ProjectProvider } from "./state/ProjectContext";
import { Home } from "./pages/Home";
import { Editor } from "./pages/Editor";
import { NotFound } from "./pages/NotFound";
import { Preview } from "./pages/Preview";
export function App() {
  return (
    <BrowserRouter>
      <ProjectProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/editor" element={<Editor />} />
          <Route path="/preview" element={<Preview />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ProjectProvider>
    </BrowserRouter>
  );
}
