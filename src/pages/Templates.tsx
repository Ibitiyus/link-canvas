import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Brand } from "../components/ui/Brand";
import { Canvas } from "../components/Canvas";
import { FontFaces } from "../components/ProjectFonts";
import {
  TEMPLATE_CATALOG,
  CATEGORIES,
  type BuiltinId,
} from "../templates/catalog";
import {
  listSaved,
  getSaved,
  renameTemplate,
  deleteTemplate,
  type SavedTemplate,
} from "../templates/storage";
import { useTemplateApply } from "../templates/useTemplateApply";
function SavedCardPreview({ project }: { project: SavedTemplate["project"] }) {
  const ref = useRef<HTMLDivElement>(null),
    [visible, setVisible] = useState(false);
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      rootMargin: "100px",
    });
    if (ref.current) o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  return (
    <div
      inert
      className="template-thumbnail template-live"
      ref={ref}
      aria-hidden="true"
    >
      {visible && (
        <>
          <FontFaces fonts={project.customFonts} />
          <Canvas
            project={{
              ...project,
              blocks: project.blocks.map((b) => ({ ...b, effects: undefined })),
              groups: project.groups?.map((g) => ({
                ...g,
                effects: undefined,
              })),
            }}
          />
        </>
      )}
    </div>
  );
}
export default function Templates() {
  const [category, setCategory] = useState("Все"),
    [saved, setSaved] = useState<SavedTemplate[]>([]),
    [error, setError] = useState(""),
    [rename, setRename] = useState<SavedTemplate | null>(null),
    [name, setName] = useState(""),
    [removing, setRemoving] = useState<SavedTemplate | null>(null);
  const { choose, dialog } = useTemplateApply(),
    renameDialog = useRef<HTMLDialogElement>(null),
    deleteDialog = useRef<HTMLDialogElement>(null);
  const reload = () =>
    listSaved()
      .then(setSaved)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void reload();
  }, []);
  useEffect(() => {
    if (rename) renameDialog.current?.showModal();
  }, [rename]);
  useEffect(() => {
    if (removing) deleteDialog.current?.showModal();
  }, [removing]);
  const builtin = (id: BuiltinId) => async () => {
    const { buildTemplate, materializeBuiltin } =
      await import("../templates/designs");
    return materializeBuiltin(buildTemplate(id, location.origin));
  };
  const own = (id: string) => async () => {
    const { freshProject } = await import("../templates/designs");
    return freshProject((await getSaved(id)).project);
  };
  const recovery = saved.find((t) => t.id === "recovery");
  return (
    <div className="templates-page">
      <header className="templates-nav">
        <Brand />
        <Link to="/">На главную</Link>
        <Link to="/editor">В редактор ↗</Link>
      </header>
      <main>
        <div className="templates-heading">
          <span className="eyebrow">СТАРТ / ВАША ТОЧКА ОТСЧЁТА</span>
          <h1>
            НЕ С НУЛЯ.
            <br />
            <em>С СЕБЯ.</em>
          </h1>
          <p>
            Выберите композицию и сделайте её своей. Каждый блок, слой и эффект
            редактируется. Предпросмотр открыт без регистрации.
          </p>
        </div>
        {recovery && (
          <div className="template-recovery">
            <span>Сохранена страница до последней замены.</span>
            <button
              onClick={() => choose("Предыдущая страница", own("recovery"))}
            >
              Восстановить предыдущую страницу
            </button>
          </div>
        )}
        <div className="template-filters" aria-label="Категории шаблонов">
          {[...CATEGORIES, "Мои"].map((c) => (
            <button
              key={c}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        {error && <p role="alert">{error}</p>}
        <div className="template-gallery">
          {TEMPLATE_CATALOG.filter(
            (t) => category === "Все" || category === t.category,
          ).map((t) => (
            <article
              key={t.id}
              className="template-card"
              data-template-id={t.id}
            >
              <Link
                to={`/templates/${t.id}`}
                aria-label={`Предпросмотр: ${t.name}`}
              >
                <img
                  className="template-thumbnail"
                  src={`/templates/previews/${t.id}.png`}
                  loading="lazy"
                  decoding="async"
                  width="640"
                  height="480"
                  alt={`Композиция ${t.name}`}
                />
              </Link>
              <div className="template-card-body">
                <small>{t.category}</small>
                <h2>{t.name}</h2>
                <p>{t.description}</p>
                <div className="template-card-actions">
                  <Link to={`/templates/${t.id}`}>Предпросмотр</Link>
                  <button onClick={() => choose(t.name, builtin(t.id))}>
                    Использовать
                  </button>
                </div>
              </div>
            </article>
          ))}
          {(category === "Все" || category === "Мои") &&
            saved
              .filter((t) => t.id !== "recovery")
              .map((t) => (
                <article
                  className="template-card"
                  key={t.id}
                  data-template-id={t.id}
                >
                  <div className="template-card-preview">
                    <SavedCardPreview project={t.project} />
                    <Link
                      className="template-preview-cover"
                      to={`/templates/${t.id}`}
                      aria-label={`Предпросмотр: ${t.name}`}
                    />
                  </div>
                  <div className="template-card-body">
                    <small>Мои / только этот браузер</small>
                    <h2>{t.name}</h2>
                    <p>Ваша редактируемая композиция с сохранёнными файлами.</p>
                    <div className="template-card-actions">
                      <Link to={`/templates/${t.id}`}>Предпросмотр</Link>
                      <button onClick={() => choose(t.name, own(t.id))}>
                        Использовать
                      </button>
                      <button
                        onClick={() => {
                          setRename(t);
                          setName(t.name);
                        }}
                      >
                        Переименовать
                      </button>
                      <button onClick={() => setRemoving(t)}>Удалить</button>
                    </div>
                  </div>
                </article>
              ))}
        </div>
        {category === "Мои" && !saved.some((t) => t.id !== "recovery") && (
          <p className="template-empty">
            Сохраните композицию кнопкой «Сохранить как шаблон» в библиотеке
            редактора.
          </p>
        )}
      </main>
      {dialog}
      {rename && (
        <dialog
          className="template-dialog"
          ref={renameDialog}
          onCancel={() => setRename(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await renameTemplate(rename.id, name);
                setRename(null);
                await reload();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <h2>Переименовать шаблон</h2>
            {error && <p role="alert">{error}</p>}
            <label>
              Новое название
              <input
                autoFocus
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div className="template-dialog-actions">
              <button type="button" onClick={() => setRename(null)}>
                Отмена
              </button>
              <button type="submit">Сохранить название</button>
            </div>
          </form>
        </dialog>
      )}
      {removing && (
        <dialog
          className="template-dialog"
          ref={deleteDialog}
          onCancel={() => setRemoving(null)}
        >
          <h2>Удалить «{removing.name}»?</h2>
          {error && <p role="alert">{error}</p>}
          <p>
            Текущая страница и публикация сохранятся. Удаляется только запись в
            библиотеке.
          </p>
          <div className="template-dialog-actions">
            <button onClick={() => setRemoving(null)}>Отмена</button>
            <button
              onClick={async () => {
                try {
                  await deleteTemplate(removing.id);
                  setRemoving(null);
                  await reload();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Удалить шаблон
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
