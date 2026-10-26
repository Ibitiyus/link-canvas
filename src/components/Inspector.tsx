import { EffectsInspector } from "./EffectsInspector";
import { freeSize } from "../model/creative";
import { isFree } from "../model/placement";
import { BlockBackground } from "./BlockBackground";
import { POSITION_LIMIT, SIZE_LIMIT } from "../model/decoration";
import { MediaInput } from "./MediaInput";
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
import { createQR } from "../model/qr";
import { safeUrl, videoSource } from "../model/media";
import { ColorField, Field, NumberField } from "./Fields";
import { PanelHeader } from "./ui/PanelHeader";
import { ImageInput } from "./ImageInput";
import { FontPicker } from "./FontPicker";
import { PageSettings } from "./PageSettings";

export function Inspector({
  requestedTab,
}: {
  requestedTab?: "block" | "page";
}) {
  const {
    project,
    selectedId,
    setLayout,
    updateBlock,
    duplicate,
    remove,
    moveLayer,
  } = useProject();
  const [tab, setTab] = useState<"block" | "page">("page");
  useEffect(() => {
    if (requestedTab) setTab(requestedTab);
    else if (selectedId) setTab("block");
  }, [selectedId, requestedTab]);
  const block = project.blocks.find((b) => b.id === selectedId);
  const qrError =
    block?.type === "qrcode" && block.url
      ? createQR(block.url).error
      : undefined;
  const patch = (update: Parameters<typeof updateBlock>[1]) => {
    if (block) updateBlock(block.id, update);
  };
  return (
    <aside
      className="inspector panel"
      id="inspector-panel"
      aria-label="Настройки блока и страницы"
    >
      <PanelHeader title="НАСТРОЙКИ" subtitle="ВСЁ РЕШАЮТ ДЕТАЛИ" />
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
          <h3>СОДЕРЖИМОЕ</h3>
          <Field label="Название блока">
            <input
              maxLength={160}
              value={block.name}
              onChange={(event) => patch({ name: event.target.value })}
            />
          </Field>
          {(block.type === "link" ||
            block.type === "text" ||
            block.type === "audio" ||
            block.type === "decoration") && (
            <Field
              label={
                block.type === "link"
                  ? "Текст кнопки"
                  : block.type === "decoration"
                    ? "Эмодзи или символ"
                    : block.type === "audio"
                      ? "Название трека"
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
          {(block.type === "link" || block.type === "qrcode") && (
            <>
              <Field
                label={
                  block.type === "qrcode"
                    ? "Ссылка для QR-кода"
                    : "Ссылка для перехода"
                }
                hint="Полный адрес, начиная с https://"
              >
                <input
                  type="url"
                  maxLength={2048}
                  placeholder="https://…"
                  value={block.url}
                  onChange={(event) => patch({ url: event.target.value })}
                />
              </Field>
              {block.type === "link" && block.url && !safeUrl(block.url) && (
                <p className="field-error">
                  Введите корректную ссылку, начиная с http:// или https://.
                </p>
              )}
            </>
          )}
          {block.type === "qrcode" && (
            <>
              {qrError && (
                <p className="field-error" role="status">
                  {qrError}
                </p>
              )}
              <p className="muted caption">
                Код обновляется при изменении ссылки. Нажатие открывает её в
                предпросмотре. Для сканирования выбирайте тёмный код и светлый
                фон.
              </p>
            </>
          )}
          {(block.type === "video" || block.type === "audio") && (
            <MediaInput
              kind={block.type === "video" ? "video" : "audio"}
              value={block.url}
              onChange={(url) => patch({ url })}
            />
          )}
          {block.type === "video" && (
            <p className="muted caption media-hint">
              Плеер можно запустить в предпросмотре.
            </p>
          )}
          {(block.type === "image" || block.type === "gif") && (
            <ImageInput
              label={
                block.type === "gif" ? "Ссылка на GIF" : "Ссылка на изображение"
              }
              value={block.url}
              onChange={(url) => patch({ url })}
            />
          )}
          {(block.type === "link" ||
            block.type === "decoration" ||
            block.type === "audio" ||
            (block.type === "video" &&
              videoSource(block.url)?.kind === "file")) && (
            <ImageInput
              label={
                block.type === "video"
                  ? "Обложка видео (необязательно)"
                  : "Изображение (необязательно)"
              }
              value={block.imageUrl}
              onChange={(imageUrl) => patch({ imageUrl })}
            />
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
                <option value="cover">Заполнить</option>
                <option value="contain">Вместить</option>
              </select>
            </Field>
          )}
          <EffectsInspector
            id={block.id}
            effects={block.effects}
            onChange={(effects) => patch({ effects })}
          />
          <h3>ОФОРМЛЕНИЕ</h3>
          <div className="field-pair">
            <ColorField
              label={block.type === "qrcode" ? "Цвет QR-кода" : "Цвет текста"}
              value={block.color}
              onChange={(color) => patch({ color })}
            />
          </div>
          <BlockBackground
            value={block.background}
            onChange={(background) => patch({ background })}
          />
          <h3>ЭФФЕКТЫ</h3>
          <div className="field-pair">
            <NumberField
              label="Скругление"
              value={block.radius}
              max={100}
              onChange={(radius) => patch({ radius })}
            />
            <NumberField
              label="Непрозрачность блока, %"
              value={Math.round(block.opacity * 100)}
              max={100}
              onChange={(value) => patch({ opacity: value / 100 })}
            />
          </div>
          <div className="field-pair">
            <NumberField
              label="Рамка, пкс"
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
          {block.type === "text" && <FontPicker block={block} />}
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
            РАЗМЕЩЕНИЕ <small>{isFree(block) ? "Свободно" : "Сетка"}</small>
          </h3>
          <Field label="Режим размещения">
            <select
              disabled={!!block.locked}
              value={isFree(block) ? "free" : "grid"}
              onChange={(e) =>
                setLayout(block.id, e.target.value as "grid" | "free")
              }
            >
              <option value="grid">Сетка</option>
              <option value="free">Свободно</option>
            </select>
          </Field>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={!!block.locked}
              onChange={(e) => patch({ locked: e.target.checked })}
            />
            Закрепить положение
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={!!block.hidden}
              onChange={(e) => patch({ hidden: e.target.checked })}
            />
            Скрыть элемент
          </label>
          <div className="layer-commands">
            {(["front", "up", "down", "back"] as const).map((action, index) => (
              <button
                key={action}
                type="button"
                onClick={() => moveLayer(block.id, action)}
              >
                {
                  [
                    "На передний план",
                    "На уровень выше",
                    "На уровень ниже",
                    "На задний план",
                  ][index]
                }
              </button>
            ))}
          </div>
          <fieldset className="geometry-fields" disabled={!!block.locked}>
            {isFree(block) ? (
              <>
                <div className="field-pair">
                  <NumberField
                    label="X"
                    value={Math.round(block.x)}
                    min={-POSITION_LIMIT}
                    max={POSITION_LIMIT}
                    onChange={(x) => patch({ x })}
                  />
                  <NumberField
                    label="Y"
                    value={Math.round(block.y)}
                    min={-POSITION_LIMIT}
                    max={POSITION_LIMIT}
                    onChange={(y) => patch({ y })}
                  />
                </div>
                <div className="field-pair">
                  <NumberField
                    label="Ширина, пкс"
                    value={Math.round(block.width)}
                    min={24}
                    max={SIZE_LIMIT}
                    onChange={(width) => patch(freeSize(block, "width", width))}
                  />
                  <NumberField
                    label="Высота, пкс"
                    value={Math.round(block.height)}
                    min={24}
                    max={SIZE_LIMIT}
                    onChange={(height) =>
                      patch(freeSize(block, "height", height))
                    }
                  />
                </div>
                <div className="field-pair">
                  <NumberField
                    label="Поворот, °"
                    value={block.rotation}
                    min={-360}
                    max={360}
                    onChange={(rotation) => patch({ rotation })}
                  />
                </div>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={!!block.keepAspect}
                    onChange={(e) => patch({ keepAspect: e.target.checked })}
                  />
                  Сохранять пропорции
                </label>
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
          </fieldset>
        </div>
      )}
    </aside>
  );
}
