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
} from "lucide-react";
import { useProject } from "../state/ProjectContext";
import { LABELS, type BlockType } from "../model/types";
export const BLOCK_ICONS = {
  link: Link,
  text: Type,
  image: Image,
  gif: Sparkles,
  video: Video,
  decoration: Shapes,
};
const DESCRIPTIONS: Record<BlockType, string> = {
  link: "Кнопка с переходом",
  text: "Слова и заголовки",
  image: "Картинка по ссылке",
  gif: "Немного движения",
  video: "YouTube или файл",
  decoration: "Поверх вашей сетки",
};
export function Library() {
  const [tab, setTab] = useState<"blocks" | "layers">("blocks");
  const { project, selectedId, select, add, remove, duplicate, reorder } =
    useProject();
  const layers = [...project.blocks].sort(
    (a, b) =>
      (b.type === "decoration" ? b.zIndex + 10000 : 0) -
      (a.type === "decoration" ? a.zIndex + 10000 : 0),
  );
  return (
    <aside className="library panel">
      <div className="panel-tabs">
        <button
          className={tab === "blocks" ? "active" : ""}
          onClick={() => setTab("blocks")}
        >
          <Plus size={15} />
          Блоки
        </button>
        <button
          className={tab === "layers" ? "active" : ""}
          onClick={() => setTab("layers")}
        >
          <Layers size={15} />
          Слои <small>{project.blocks.length}</small>
        </button>
      </div>
      {tab === "blocks" ? (
        <>
          <div className="panel-heading">СОБЕРИТЕ СВОЮ СТРАНИЦУ</div>
          <div className="block-library">
            {(Object.keys(LABELS) as BlockType[]).map((type) => {
              const Icon = BLOCK_ICONS[type];
              return (
                <button
                  key={type}
                  className="library-item"
                  onClick={() => add(type)}
                  aria-label={`Добавить: ${LABELS[type]}`}
                >
                  <span className={`library-icon icon-${type}`}>
                    <Icon size={21} />
                  </span>
                  <strong>{LABELS[type]}</strong>
                  <small>{DESCRIPTIONS[type]}</small>
                  <Plus className="library-plus" size={15} />
                </button>
              );
            })}
          </div>
          <div className="library-tip">
            <MousePointer2 size={18} />
            <p>
              Добавьте блок, затем перемещайте его за ручку <b>⠿</b>. Тяните
              угол выбранного блока, чтобы изменить размер.
            </p>
          </div>
        </>
      ) : (
        <div className="layers-list">
          <p className="muted caption">
            Декор выше в списке — ближе к зрителю. Сеточные блоки
            упорядочиваются на полотне.
          </p>
          {!layers.length && (
            <p className="empty-note">Здесь появятся ваши блоки.</p>
          )}
          {layers.map((block) => {
            const Icon = BLOCK_ICONS[block.type];
            const free = project.blocks
              .filter((b) => b.type === "decoration")
              .sort((a, b) => a.zIndex - b.zIndex);
            const index = free.findIndex((b) => b.id === block.id);
            return (
              <div
                key={block.id}
                className={`layer-row ${selectedId === block.id ? "active" : ""}`}
              >
                <button
                  className="layer-select"
                  onClick={() => select(block.id)}
                >
                  <Icon size={16} />
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
                        <ArrowUp size={13} />
                      </button>
                      <button
                        title={`Ниже: ${block.name}`}
                        aria-label={`Ниже: ${block.name}`}
                        disabled={index === 0}
                        onClick={() => reorder(block.id, -1)}
                      >
                        <ArrowDown size={13} />
                      </button>
                    </>
                  )}
                  <button
                    title={`Дублировать: ${block.name}`}
                    aria-label={`Дублировать: ${block.name}`}
                    onClick={() => duplicate(block.id)}
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    title={`Удалить: ${block.name}`}
                    aria-label={`Удалить: ${block.name}`}
                    onClick={() => remove(block.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="library-bottom">
        <span className="tiny-dot" /> Все изменения — в вашем браузере
      </div>
    </aside>
  );
}
