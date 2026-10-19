import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Canvas } from "../components/Canvas";
import { FontFaces } from "../components/ProjectFonts";
import { supabase } from "../cloud/config";
import { usernameError } from "../auth/usernames";
import { parseProject } from "../model/storage";
import type { Project } from "../model/types";
import { safeImageSource } from "../model/assets";
import { NotFound } from "./NotFound";
export function PublicPage() {
  const { username = "" } = useParams();
  const [project, setProject] = useState<Project | null>(null),
    [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">(
      "loading",
    );
  useEffect(() => {
    let active = true;
    setProject(null);
    setStatus("loading");
    if (!supabase || usernameError(username)) {
      setStatus("missing");
      return;
    }
    Promise.resolve(
      supabase
        .from("published_pages")
        .select("project")
        .eq("username", username)
        .maybeSingle(),
    )
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setStatus("error");
          return;
        }
        if (!data) {
          setStatus("missing");
          return;
        }
        try {
          const project = parseProject(JSON.stringify(data.project));
          setProject(project);
          setStatus("ready");
          document.title = `${project.page.title || username} — ZIN`;
        } catch {
          setStatus("error");
        }
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
      document.title = "ZIN — ваш интернет, ваши правила";
    };
  }, [username]);
  if (status === "missing") return <NotFound />;
  if (status === "loading")
    return (
      <div className="public-loading" role="status">
        Загрузка страницы…
      </div>
    );
  if (status === "error" || !project)
    return (
      <div className="public-loading" role="alert">
        <p>Не удалось загрузить страницу. Проверьте подключение к интернету.</p>
        <button className="secondary-button" onClick={() => location.reload()}>
          Повторить
        </button>
      </div>
    );
  const background = safeImageSource(project.page.backgroundImage);
  return (
    <div
      className="preview-page public-page"
      style={{
        backgroundColor: project.page.background,
        backgroundImage: background
          ? `url(${JSON.stringify(background)})`
          : undefined,
      }}
    >
      <FontFaces fonts={project.customFonts} />
      <main className="preview-content" aria-label={project.page.title}>
        <Canvas project={project} />
      </main>
    </div>
  );
}
