import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Project } from "../model/types";
import { Canvas } from "../components/Canvas";
import { PageBackground } from "../components/PageBackground";
import { FontFaces } from "../components/ProjectFonts";
import { TEMPLATE_CATALOG } from "../templates/catalog";
import { getSaved } from "../templates/storage";
import { useTemplateApply } from "../templates/useTemplateApply";
export default function TemplatePreview() {
  const { id } = useParams(),
    [data, setData] = useState<{ name: string; project: Project } | null>(null),
    [error, setError] = useState(""),
    { choose, dialog } = useTemplateApply();
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    (async () => {
      const t = TEMPLATE_CATALOG.find((t) => t.id === id);
      const d = await import("../templates/designs");
      const result = t
        ? { name: t.name, project: d.buildTemplate(t.id, location.origin) }
        : await getSaved(id ?? "");
      if (active) setData(result);
    })().catch((e) => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <div
      className="preview-page template-preview"
      style={{ backgroundColor: data?.project.page.background }}
    >
      {data && (
        <>
          <PageBackground page={data.project.page} />
          <FontFaces fonts={data.project.customFonts} />
        </>
      )}
      <header className="template-preview-bar">
        <Link to="/templates">← Шаблоны</Link>
        <span>{data?.name ?? "Предпросмотр шаблона"}</span>
        {data && (
          <button
            onClick={() =>
              choose(data.name, async () => {
                const d = await import("../templates/designs");
                return TEMPLATE_CATALOG.some((t) => t.id === id)
                  ? d.materializeBuiltin(data.project)
                  : d.freshProject(data.project);
              })
            }
          >
            Использовать шаблон
          </button>
        )}
      </header>
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <p role="status">Загружаем композицию…</p>
      ) : (
        <main className="preview-content" aria-label={data.project.page.title}>
          <Canvas project={data.project} />
        </main>
      )}
      {dialog}
    </div>
  );
}
