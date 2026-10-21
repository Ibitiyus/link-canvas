import { FontFaces } from "../components/ProjectFonts";
import { PagePreloader } from "../components/PagePreloader";
import { ZinFooter } from "../components/ZinFooter";
import { useState } from "react";
import { X } from "lucide-react";
import { Canvas } from "../components/Canvas";
import { PageBackground } from "../components/PageBackground";
import { BackLink } from "../components/Toolbar";
import { useProject } from "../state/ProjectContext";
export function Preview() {
  const { project } = useProject();
  const [notice, setNotice] = useState(true);
  return (
    <PagePreloader>
      <div
        className="preview-page"
        style={{
          backgroundColor: project.page.background,
        }}
      >
        <PageBackground page={project.page} />
        <FontFaces fonts={project.customFonts} />
        {notice && (
          <div className="preview-notice">
            <span className="preview-mode">[ ПРЕДПРОСМОТР ]</span>
            <BackLink />
            <span>
              Предпросмотр черновика · для публичного доступа опубликуйте
              страницу
            </span>
            <button
              aria-label="Скрыть подсказку"
              title="Скрыть подсказку"
              onClick={() => setNotice(false)}
            >
              <X size={17} />
            </button>
          </div>
        )}
        <main className="preview-content" aria-label={project.page.title}>
          <Canvas project={project} />
        </main>
        <ZinFooter />
      </div>
    </PagePreloader>
  );
}
