import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Image,
  Layers,
  Link,
  MousePointer2,
  Plus,
  Shapes,
  Sparkles,
  Trash2,
  Type,
  Video,
  Music2,
  QrCode,
} from "lucide-react";
import { useProject } from "../state/ProjectContext";
import { LABELS, type BlockType } from "../model/types";
import { PanelHeader } from "./ui/PanelHeader";
export const BLOCK_ICONS = {
  link: Link,
  text: Type,
  image: Image,
  gif: Sparkles,
  video: Video,
  audio: Music2,
  qrcode: QrCode,
  decoration: Shapes,
};
const DESCRIPTIONS: Record<BlockType, string> = {
  link: "Кнопка с переходом",
  text: "Слова и заголовки",
  image: "Файл или ссылка",
  gif: "Немного движения",
  video: "YouTube или файл",
  audio: "Свой звук и плеер",
  qrcode: "Сканируй или нажми",
  decoration: "Поверх вашей сетки",
};
const GROUPS: { code: string; title: string; types: BlockType[] }[] = [
  { code: "А", title: "БЛОКИ", types: ["link", "text", "qrcode"] },
  { code: "Б", title: "МЕДИА", types: ["image", "gif", "video", "audio"] },
  { code: "В", title: "ДЕКОР", types: ["decoration"] },
];
export function Library({ onAdd }: { onAdd?: () => void }) {
  const [tab, setTab] = useState<"blocks" | "layers">("blocks");
  const { project, selectedId, select, add, remove, duplicate, reorder } =
    useProject();
  const layers = [...project.blocks].sort(
    (a, b) =>
      (b.type === "decoration" ? b.zIndex + 10000 : 0) -
      (a.type === "decoration" ? a.zIndex + 10000 : 0),
  );
  const free = project.blocks
    .filter((b) => b.type === "decoration")
    .sort((a, b) => a.zIndex - b.zIndex);
  return (
    <aside
      className="library panel"
      id="library-panel"
      aria-label="Библиотека блоков и слои"
    >
      <PanelHeader
        index="01"
        title="БИБЛИОТЕКА БЛОКОВ"
        subtitle="ДОБАВЬТЕ НЕМНОГО СЕБЯ"
      />
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
                Тяните блок за ручку ⠿.
                <br />
                Меняйте размер за угол.
                <br />
                Правила задаёте вы.
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="layers-list">
          <div className="layer-count">
            <span>ПОРЯДОК СЛОЁВ</span>
            <b>{project.blocks.length} ЭЛ.</b>
          </div>
          <p className="muted caption">
            Декор выше в списке — ближе к зрителю. Сеточные блоки
            упорядочиваются на полотне.
          </p>
          {!layers.length && (
            <p className="empty-note">
              [ ПУСТО ]<br />
              Добавьте первый блок во вкладке «Блоки».
            </p>
          )}
          {layers.map((block, i) => {
            const Icon = BLOCK_ICONS[block.type],
              index = free.findIndex((b) => b.id === block.id);
            return (
              <div
                key={block.id}
                className={`layer-row ${selectedId === block.id ? "active" : ""}`}
              >
                <button
                  className="layer-select"
                  onClick={() => select(block.id)}
                >
                  <small>{String(i + 1).padStart(2, "0")}</small>
                  <Icon size={15} />
                  <span>{block.name}</span>
                </button>
                <div className="layer-actions">
                  {block.type === "decoration" && (
                    <>
                      <button
                        title={`Выше: ${block.name}`}
                        aria-label={`Выше: ${block.name}`}
                        disabled={index === free.length - 1}
                        onClick={() => reorder(block.id, 1)}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        title={`Ниже: ${block.name}`}
                        aria-label={`Ниже: ${block.name}`}
                        disabled={index === 0}
                        onClick={() => reorder(block.id, -1)}
                      >
                        <ArrowDown size={14} />
                      </button>
                    </>
                  )}
                  <button
                    title={`Дублировать: ${block.name}`}
                    aria-label={`Дублировать: ${block.name}`}
                    onClick={() => duplicate(block.id)}
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    title={`Удалить: ${block.name}`}
                    aria-label={`Удалить: ${block.name}`}
                    onClick={() => remove(block.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="library-bottom">
        <span className="tiny-dot" />
        ХРАНИТСЯ У ВАС. ВСЕГДА ВАШЕ.
      </div>
    </aside>
  );
}
