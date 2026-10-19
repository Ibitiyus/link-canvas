import { useEffect, useMemo, useState } from "react";
import { Eye, Grip, MoveUpRight } from "lucide-react";
import { Canvas } from "./Canvas";
import { emptyProject, newBlock } from "../model/defaults";
import { editBlock } from "../model/grid";
import type { Project } from "../model/types";
function specimen(): Project {
  const url = (path: string) => new URL(path, window.location.origin).href;
  return {
    ...emptyProject(),
    page: {
      ...emptyProject().page,
      title: "ВНЕ ЛЕНТЫ.",
      maxWidth: 700,
      gap: 10,
      background: "#17171a",
      font: "mono",
    },
    blocks: [
      {
        ...newBlock("text"),
        id: "spec-text",
        name: "Манифест",
        content: "МЫСЛИ\nБЕЗ СЕТИ.\nМИР\nВ СЕТИ.",
        colSpan: 2,
        rowSpan: 3,
        fontSize: 25,
        bold: true,
        background: "#f2efeb",
        color: "#0d0d0f",
        radius: 0,
      },
      {
        ...newBlock("image"),
        id: "spec-image",
        name: "Постер",
        url: url("/demo/poster.svg"),
        col: 2,
        colSpan: 2,
        rowSpan: 3,
        radius: 0,
      },
      {
        ...newBlock("link"),
        id: "spec-link-1",
        name: "Instagram",
        content: "Instagram",
        url: "https://www.instagram.com",
        col: 0,
        row: 3,
        fontSize: 12,
        background: "#ff4fa3",
        color: "#0d0d0f",
        radius: 0,
      },
      {
        ...newBlock("link"),
        id: "spec-link-2",
        name: "GitHub",
        content: "GitHub",
        url: "https://github.com",
        col: 1,
        row: 3,
        fontSize: 12,
        background: "#ff3355",
        color: "#0d0d0f",
        radius: 0,
      },
      {
        ...newBlock("gif"),
        id: "spec-gif",
        name: "GIF: волна",
        url: url("/demo/signal.gif"),
        col: 2,
        row: 3,
        colSpan: 2,
        radius: 0,
      },
      {
        ...newBlock("video"),
        id: "spec-video",
        name: "Видео: трансляция",
        url: url("/demo/transmission.webm"),
        imageUrl: url("/demo/video-poster.svg"),
        row: 4,
        colSpan: 2,
        rowSpan: 2,
        radius: 0,
      },
      {
        ...newBlock("text"),
        id: "spec-note",
        name: "Заметка",
        content: "НЕМНОГО ХАОСА.\nМНОГО ВАС.\n\n[ ЭТО МОЁ МЕСТО ]",
        col: 2,
        row: 4,
        colSpan: 2,
        rowSpan: 2,
        fontSize: 16,
        background: "#222226",
        color: "#ffb6cf",
        radius: 0,
      },
      {
        ...newBlock("decoration"),
        id: "spec-decor",
        name: "Звезда",
        content: "✳",
        color: "#ff3355",
        fontSize: 90,
        width: 100,
        height: 100,
        x: 280,
        y: 130,
        rotation: 15,
      },
    ],
  };
}
export function Showcase() {
  const [project, setProject] = useState(specimen);
  const [editing, setEditing] = useState(true);
  const [selectedId, select] = useState<string | null>("spec-text");
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(query.matches);
    change();
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  const displayed = useMemo(
    () =>
      reduced
        ? {
            ...project,
            blocks: project.blocks.map((b) =>
              b.type === "gif"
                ? {
                    ...b,
                    url: new URL("/demo/signal-still.svg", location.origin)
                      .href,
                  }
                : b,
            ),
          }
        : project,
    [project, reduced],
  );
  return (
    <div className="specimen" data-testid="showcase">
      <div className="specimen-top">
        <span className="tiny-dot" />
        <span>ПЕСОЧНИЦА / 01</span>
        <span className="specimen-mode">
          {editing ? "РЕДАКТИРОВАНИЕ" : "ПРОСМОТР"}
        </span>
        <button onClick={() => setEditing(!editing)} aria-pressed={!editing}>
          {editing ? <Eye size={14} /> : <Grip size={14} />}
          {editing ? "Смотреть пример" : "Редактировать пример"}
        </button>
      </div>
      <div className="specimen-ruler" aria-hidden="true">
        <span>01</span>
        <span>02</span>
        <span>03</span>
        <span>04</span>
      </div>
      <Canvas
        project={displayed}
        rowHeight={80}
        editing={editing}
        selectedId={selectedId}
        onSelect={select}
        onUpdate={(id, patch) => setProject((p) => editBlock(p, id, patch))}
      />
      <div className="specimen-bottom">
        <Grip size={13} />
        <span>
          {editing
            ? "Тяните блоки за ручку. Меняйте размер за угол."
            : "Ссылки и видео работают. Попробуйте."}
        </span>
        <MoveUpRight size={14} />
      </div>
    </div>
  );
}
