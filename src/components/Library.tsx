import { TemplateEntry } from "./TemplateEntry";
import { LayerList } from "./LayerList";
import { useEffect, useState } from "react";
import { Layers, MousePointer2, Plus } from "lucide-react";
import { useProject } from "../state/ProjectContext";
import { LABELS, type BlockType } from "../model/types";
import { PanelHeader } from "./ui/PanelHeader";
import { BLOCK_ICONS } from "./blockIcons";
export { BLOCK_ICONS } from "./blockIcons";
const DESCRIPTIONS: Record<BlockType, string> = {
  link: "Кнопка с переходом",
  text: "Слова и заголовки",
  image: "Файл или ссылка",
  gif: "Немного движения",
  video: "YouTube или файл",
  audio: "Свой звук и плеер",
  qrcode: "Сканируй или нажми",
  decoration: "Над блоками и за ними",
};
const GROUPS: { code: string; title: string; types: BlockType[] }[] = [
  { code: "А", title: "БЛОКИ", types: ["link", "text", "qrcode"] },
  { code: "Б", title: "МЕДИА", types: ["image", "gif", "video", "audio"] },
  { code: "В", title: "ДЕКОР", types: ["decoration"] },
];
export function Library({
  onAdd,
  requestedTab,
}: {
  onAdd?: () => void;
  requestedTab?: "blocks" | "layers";
}) {
  const [tab, setTab] = useState<"blocks" | "layers">("blocks");
  const { project, add } = useProject();
  useEffect(() => {
    if (requestedTab) setTab(requestedTab);
  }, [requestedTab]);
  return (
    <aside
      className="library panel"
      id="library-panel"
      aria-label="Библиотека блоков и слои"
    >
      <PanelHeader title="БИБЛИОТЕКА БЛОКОВ" subtitle="ДОБАВЬТЕ НЕМНОГО СЕБЯ" />
      <TemplateEntry />
      <div className="panel-tabs">
        <button
          aria-label="Блоки"
          aria-pressed={tab === "blocks"}
          className={tab === "blocks" ? "active" : ""}
          onClick={() => setTab("blocks")}
        >
          <Plus size={14} />
          БЛОКИ
        </button>
        <button
          aria-label={`Слои ${project.blocks.length}`}
          aria-pressed={tab === "layers"}
          className={tab === "layers" ? "active" : ""}
          onClick={() => setTab("layers")}
        >
          <Layers size={14} />
          СЛОИ <small>{String(project.blocks.length).padStart(2, "0")}</small>
        </button>
      </div>
      {tab === "blocks" ? (
        <>
          <div className="block-library">
            {GROUPS.map((group) => (
              <section className="tool-group" key={group.code}>
                <h2>
                  <span>{group.code} /</span> {group.title}
                </h2>
                <div className="tool-group-items">
                  {group.types.map((type, index) => {
                    const Icon = BLOCK_ICONS[type];
                    return (
                      <button
                        key={type}
                        className="library-item"
                        onClick={() => {
                          add(type);
                          onAdd?.();
                        }}
                        aria-label={`Добавить: ${LABELS[type]}`}
                      >
                        <span className="library-icon">
                          <Icon size={21} strokeWidth={1.5} />
                        </span>
                        <strong>{LABELS[type]}</strong>
                        <small>{DESCRIPTIONS[type]}</small>
                        <span className="tool-index" aria-hidden="true">
                          {group.code}
                          {index + 1}
                        </span>
                        <Plus className="library-plus" size={15} />
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          <div className="library-tip">
            <MousePointer2 size={19} />
            <div>
              <span>ПЕРЕТАЩИТЕ НА МЕСТО</span>
              <p>
                Тяните блок за поверхность.
                <br />
                На телефоне сначала удерживайте блок.
                <br />
                Правила задаёте вы.
              </p>
            </div>
          </div>
        </>
      ) : (
        <LayerList />
      )}
      <div className="library-bottom">
        <span className="tiny-dot" />
        ХРАНИТСЯ У ВАС. ВСЕГДА ВАШЕ.
      </div>
    </aside>
  );
}
