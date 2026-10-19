import { useProject } from "../state/ProjectContext";
import { ColorField, Field, NumberField } from "./Fields";
import { safeUrl } from "../model/media";
export function PageSettings() {
  const { project, updatePage } = useProject();
  const { page } = project;
  return (
    <div className="inspector-fields">
      <Field label="Название страницы">
        <input
          value={page.title}
          maxLength={160}
          onChange={(event) => updatePage({ title: event.target.value })}
        />
      </Field>
      <h3>Оформление</h3>
      <div className="theme-presets" aria-label="Варианты оформления">
        <button
          className="theme-dark"
          onClick={() =>
            updatePage({
              background: "#171321",
              backgroundImage: "",
              font: "system",
              gap: 16,
            })
          }
        >
          <i />
          Ночь
        </button>
        <button
          className="theme-paper"
          onClick={() =>
            updatePage({
              background: "#f5f1e9",
              backgroundImage: "",
              font: "serif",
              gap: 20,
            })
          }
        >
          <i />
          Бумага
        </button>
        <button
          className="theme-mint"
          onClick={() =>
            updatePage({
              background: "#d9eee7",
              backgroundImage: "",
              font: "mono",
              gap: 12,
            })
          }
        >
          <i />
          Мята
        </button>
      </div>
      <ColorField
        label="Фон страницы"
        value={page.background}
        onChange={(background) => updatePage({ background })}
      />
      <Field label="Фоновое изображение" hint="Полный HTTP(S) URL">
        <input
          type="url"
          placeholder="https://…"
          value={page.backgroundImage}
          maxLength={2048}
          onChange={(event) =>
            updatePage({ backgroundImage: event.target.value })
          }
        />
      </Field>
      {page.backgroundImage && !safeUrl(page.backgroundImage) && (
        <p className="field-error">Некорректный URL фонового изображения.</p>
      )}
      <Field label="Основной шрифт">
        <select
          value={page.font}
          onChange={(event) =>
            updatePage({ font: event.target.value as typeof page.font })
          }
        >
          <option value="system">Современный · Sans</option>
          <option value="serif">Классический · Serif</option>
          <option value="mono">Моноширинный · Mono</option>
        </select>
      </Field>
      <h3>Сетка и полотно</h3>
      <Field label="Колонки">
        <select
          value={page.columns}
          onChange={(event) =>
            updatePage({ columns: Number(event.target.value) as 3 | 4 | 5 })
          }
        >
          <option value={3}>3 колонки</option>
          <option value={4}>4 колонки</option>
          <option value={5}>5 колонок</option>
        </select>
      </Field>
      <NumberField
        label="Расстояние между блоками"
        value={page.gap}
        max={48}
        onChange={(gap) => updatePage({ gap })}
      />
      <NumberField
        label="Максимальная ширина страницы"
        value={page.maxWidth}
        min={320}
        max={1400}
        step={10}
        onChange={(maxWidth) => updatePage({ maxWidth })}
      />
      <p className="muted caption">
        При смене сетки блоки перераспределяются без наложений. Декор
        располагается независимо от ячеек.
      </p>
    </div>
  );
}
