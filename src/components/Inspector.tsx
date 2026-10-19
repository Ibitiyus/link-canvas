import { useEffect, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Copy,
  MousePointer2,
  Settings2,
  Trash2,
} from "lucide-react";
import { useProject } from "../state/ProjectContext";
import { LABELS, type Align } from "../model/types";
import { safeUrl, videoSource } from "../model/media";
import { ColorField, Field, NumberField } from "./Fields";
import { PanelHeader } from "./ui/PanelHeader";
import { PageSettings } from "./PageSettings";

export function Inspector() {
  const { project, selectedId, updateBlock, duplicate, remove } = useProject();
  const [tab, setTab] = useState<"block" | "page">("page");
  useEffect(() => {
    if (selectedId) setTab("block");
  }, [selectedId]);
  const block = project.blocks.find((b) => b.id === selectedId);
  const patch = (update: Parameters<typeof updateBlock>[1]) => {
    if (block) updateBlock(block.id, update);
  };
  return (
    <aside
      className="inspector panel"
      id="inspector-panel"
      aria-label="Настройки блока и страницы"
    >
      <PanelHeader
        index="03"
        title="CONTROL PANEL"
        subtitle="ВСЁ РЕШАЮТ ДЕТАЛИ"
      />
      <div className="panel-tabs">
        <button
          className={tab === "block" ? "active" : ""}
          onClick={() => setTab("block")}
        >
          <MousePointer2 size={14} />
          Блок
        </button>
        <button
          className={tab === "page" ? "active" : ""}
          onClick={() => setTab("page")}
        >
          <Settings2 size={14} />
          Страница
        </button>
      </div>
      {tab === "page" ? (
        <PageSettings />
      ) : !block ? (
        <div className="inspector-empty">
          <MousePointer2 size={32} />
          <h3>Ваши детали</h3>
          <p>
            Выберите блок на полотне, чтобы изменить содержимое и оформление.
          </p>
        </div>
      ) : (
        <div className="inspector-fields" key={block.id}>
          <div className="inspector-title">
            <span>{LABELS[block.type]}</span>
            <div className="inline-actions">
              <button
                title="Дублировать блок"
                aria-label="Дублировать блок"
                onClick={() => duplicate(block.id)}
              >
                <Copy size={16} />
              </button>
              <button
                className="danger"
                title="Удалить блок"
                aria-label="Удалить блок"
                onClick={() => remove(block.id)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <h3>
            <span>01 /</span> CONTENT <small>Содержимое</small>
          </h3>
          <Field label="Название блока">
            <input
              maxLength={160}
              value={block.name}
              onChange={(event) => patch({ name: event.target.value })}
            />
          </Field>
          {(block.type === "link" ||
            block.type === "text" ||
            block.type === "decoration") && (
            <Field
              label={
                block.type === "link"
                  ? "Текст кнопки"
                  : block.type === "decoration"
                    ? "Emoji или символ"
                    : "Текст"
              }
            >
              <textarea
                rows={block.type === "text" ? 4 : 2}
                maxLength={10000}
                value={block.content}
                onChange={(event) => patch({ content: event.target.value })}
              />
            </Field>
          )}
          {["link", "image", "gif", "video"].includes(block.type) && (
            <>
              <Field
                label={
                  block.type === "video"
                    ? "URL видео"
                    : block.type === "link"
                      ? "URL ссылки"
                      : block.type === "gif"
                        ? "URL GIF"
                        : "URL изображения"
                }
                hint={
                  block.type === "video"
                    ? "YouTube, MP4, WebM или OGV"
                    : "Полный адрес, начиная с https://"
                }
              >
                <input
                  type="url"
                  maxLength={2048}
                  placeholder="https://…"
                  value={block.url}
                  onChange={(event) => patch({ url: event.target.value })}
                />
              </Field>
              {block.url &&
                (block.type === "video"
                  ? !videoSource(block.url)
                  : !safeUrl(block.url)) && (
                  <p className="field-error">
                    {block.type === "video"
                      ? "Эта ссылка на видео не поддерживается."
                      : "Введите корректный HTTP(S) URL."}
                  </p>
                )}
            </>
          )}
          {block.type === "video" && (
            <p className="muted caption media-hint">
              Плеер можно запустить в предпросмотре.
            </p>
          )}
          {(block.type === "link" || block.type === "decoration") && (
            <Field label="Изображение (необязательно)">
              <input
                type="url"
                value={block.imageUrl}
                maxLength={2048}
                placeholder="https://…"
                onChange={(event) => patch({ imageUrl: event.target.value })}
              />
            </Field>
          )}
          {(["image", "gif", "link", "decoration"].includes(block.type) ||
            (block.type === "video" &&
              videoSource(block.url)?.kind === "file")) && (
            <Field label="Отображение медиа">
              <select
                value={block.fit}
                onChange={(event) =>
                  patch({ fit: event.target.value as "contain" | "cover" })
                }
              >
                <option value="cover">Заполнить · cover</option>
                <option value="contain">Вместить · contain</option>
              </select>
            </Field>
          )}
          <h3>
            <span>02 /</span> APPEARANCE <small>Оформление</small>
          </h3>
          <div className="field-pair">
            <ColorField
              label="Фон блока"
              value={block.background}
              onChange={(background) => patch({ background })}
            />
            <ColorField
              label="Цвет текста"
              value={block.color}
              onChange={(color) => patch({ color })}
            />
          </div>
          {block.type === "decoration" && (
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={
                  block.background.length === 9 &&
                  block.background.endsWith("00")
                }
                onChange={(event) =>
                  patch({
                    background: event.target.checked ? "#00000000" : "#222226",
                  })
                }
              />
              Прозрачный фон
            </label>
          )}
          <h3>
            <span>03 /</span> EFFECTS <small>Эффекты</small>
          </h3>
          <div className="field-pair">
            <NumberField
              label="Скругление"
              value={block.radius}
              max={100}
              onChange={(radius) => patch({ radius })}
            />
            <NumberField
              label="Прозрачность, %"
              value={Math.round(block.opacity * 100)}
              max={100}
              onChange={(value) => patch({ opacity: value / 100 })}
            />
          </div>
          <div className="field-pair">
            <NumberField
              label="Рамка, px"
              value={block.borderWidth}
              max={20}
              onChange={(borderWidth) => patch({ borderWidth })}
            />
            <ColorField
              label="Цвет рамки"
              value={block.borderColor}
              onChange={(borderColor) => patch({ borderColor })}
            />
          </div>
          {["text", "link", "decoration"].includes(block.type) && (
            <>
              <NumberField
                label="Размер шрифта"
                value={block.fontSize}
                min={8}
                max={144}
                onChange={(fontSize) => patch({ fontSize })}
              />
              <div className="format-buttons">
                <button
                  title="Жирный текст"
                  aria-label="Жирный текст"
                  aria-pressed={block.bold}
                  className={block.bold ? "active" : ""}
                  onClick={() => patch({ bold: !block.bold })}
                >
                  <Bold size={16} />
                </button>
                {(["left", "center", "right"] as Align[]).map(
                  (align, index) => {
                    const Icon = [AlignLeft, AlignCenter, AlignRight][index];
                    const name = ["Слева", "По центру", "Справа"][index];
                    return (
                      <button
                        key={align}
                        title={name}
                        aria-label={name}
                        aria-pressed={block.align === align}
                        className={block.align === align ? "active" : ""}
                        onClick={() => patch({ align })}
                      >
                        <Icon size={16} />
                      </button>
                    );
                  },
                )}
              </div>
            </>
          )}
          <h3>
            <span>04 /</span> LAYOUT{" "}
            <small>{block.type === "decoration" ? "Свободно" : "Сетка"}</small>
          </h3>
          {block.type === "decoration" ? (
            <>
              <div className="field-pair">
                <NumberField
                  label="X"
                  value={Math.round(block.x)}
                  max={project.page.maxWidth - 24}
                  onChange={(x) => patch({ x })}
                />
                <NumberField
                  label="Y"
                  value={Math.round(block.y)}
                  max={30000}
                  onChange={(y) => patch({ y })}
                />
              </div>
              <div className="field-pair">
                <NumberField
                  label="Ширина, px"
                  value={Math.round(block.width)}
                  min={24}
                  max={project.page.maxWidth}
                  onChange={(width) => patch({ width })}
                />
                <NumberField
                  label="Высота, px"
                  value={Math.round(block.height)}
                  min={24}
                  max={2000}
                  onChange={(height) => patch({ height })}
                />
              </div>
              <div className="field-pair">
                <NumberField
                  label="Поворот, °"
                  value={block.rotation}
                  min={-180}
                  max={180}
                  onChange={(rotation) => patch({ rotation })}
                />
                <NumberField
                  label="z-index"
                  value={block.zIndex}
                  min={1}
                  max={10000}
                  onChange={(zIndex) => patch({ zIndex })}
                />
              </div>
            </>
          ) : (
            <>
              <div className="field-pair">
                <NumberField
                  label="Колонка"
                  value={block.col + 1}
                  min={1}
                  max={project.page.columns - block.colSpan + 1}
                  onChange={(value) => patch({ col: value - 1 })}
                />
                <NumberField
                  label="Строка"
                  value={block.row + 1}
                  min={1}
                  max={2001}
                  onChange={(value) => patch({ row: value - 1 })}
                />
              </div>
              <div className="field-pair">
                <NumberField
                  label="Ширина, ячеек"
                  value={block.colSpan}
                  min={1}
                  max={project.page.columns}
                  onChange={(colSpan) => patch({ colSpan })}
                />
                <NumberField
                  label="Высота, ячеек"
                  value={block.rowSpan}
                  min={1}
                  max={12}
                  onChange={(rowSpan) => patch({ rowSpan })}
                />
              </div>
              <p className="muted caption">
                Занятые блоки автоматически сдвинутся в свободные ячейки.
                Перемещение и размер можно отменить.
              </p>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
