import { useState } from "react";
import { X } from "lucide-react";
import { Canvas } from "../components/Canvas";
import { BackLink } from "../components/Toolbar";
import { useProject } from "../state/ProjectContext";
import { safeUrl } from "../model/media";
export function Preview() {
  const { project } = useProject();
  const [notice, setNotice] = useState(true);
  const background = safeUrl(project.page.backgroundImage);
  return (
    <div
      className="preview-page"
      style={{
        backgroundColor: project.page.background,
        backgroundImage: background
          ? `url(${JSON.stringify(background)})`
          : undefined,
      }}
    >
      {notice && (
        <div className="preview-notice">
          <span className="preview-mode">[ PREVIEW_MODE ]</span>
          <BackLink />
          <span>Локальный предпросмотр · доступен только в этом браузере</span>
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
    </div>
  );
}
