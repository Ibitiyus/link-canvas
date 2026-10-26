import { ServiceArrow } from "../components/ui/ServiceArrow";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ownerClient } from "../cloud/config";
import { cloudError } from "../cloud/errors";
import { CATEGORIES, presentationError, type Presentation } from "./model";
import { createGalleryCover } from "./cover";
export function GallerySettings({
  owner,
  published,
  title,
}: {
  owner: string;
  published: string | null;
  title: string;
}) {
  const [value, setValue] = useState<Presentation>({
    title: title || "Мой ZIN",
    description: "",
    category: "Other",
    cover: "",
  });
  const [listed, setListed] = useState(false),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setReady(false);
    void Promise.resolve(
      ownerClient(owner)
        .from("explore_settings")
        .select("listed,title,description,category,cover")
        .eq("owner_id", owner)
        .maybeSingle(),
    )
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setError(
            "Не удалось загрузить настройки галереи. Проверьте подключение и применение миграции Explore.",
          );
          return;
        }
        if (data) {
          setListed(data.listed);
          setValue({
            title: data.title || title || "Мой ZIN",
            description: data.description,
            category: data.category,
            cover: data.cover,
          });
        }
        setReady(true);
        setError("");
      })
      .catch(() => {
        if (active) setError("Нет связи с галереей. Повторите подключение.");
      });
    return () => {
      active = false;
    };
  }, [owner, retry]);
  const update = (patch: Partial<Presentation>) => {
    setValue((v) => ({ ...v, ...patch }));
    setNotice("Есть несохранённые настройки представления.");
  };
  async function visibility(visible: boolean) {
    const previous = listed;
    setListed(visible);
    setBusy(true);
    setError("");
    setNotice("Сохраняем настройку участия…");
    try {
      const { error } = await ownerClient(owner).rpc("set_explore_visibility", {
        visible,
      });
      if (error) throw error;
      setListed(visible);
      setNotice(
        visible
          ? "Участие включено. В галерее появится только опубликованная версия, если она не скрыта модератором."
          : "Участие выключено. Прямая публичная ссылка продолжает работать.",
      );
    } catch (error) {
      setListed(previous);
      setNotice("");
      setError(cloudError(error));
    } finally {
      setBusy(false);
    }
  }
  async function save(publishNow: boolean) {
    const invalid = presentationError(value);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error } = await ownerClient(owner).rpc("save_explore_settings", {
        new_title: value.title.trim(),
        new_description: value.description.trim(),
        new_category: value.category,
        new_cover: value.cover,
        publish_now: publishNow,
      });
      if (error) throw error;
      setNotice(
        publishNow
          ? "Представление опубликовано. Композиция страницы не менялась."
          : "Настройки сохранены до следующей публикации. Публичное представление не менялось.",
      );
    } catch (error) {
      setError(cloudError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="account-card gallery-settings"
      aria-labelledby="gallery-settings-title"
    >
      <div className="dashboard-title">
        <h2 id="gallery-settings-title">Публикация в галерее</h2>
        <Link to="/explore">
          Открыть Explore <ServiceArrow />
        </Link>
      </div>
      <p>
        Ваша страница будет доступна другим пользователям через поиск и галерею
        ZIN. Публичная ссылка продолжит работать даже при выключении этой
        настройки.
      </p>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {!ready ? (
        error ? (
          <button
            className="secondary-button"
            onClick={() => setRetry((n) => n + 1)}
          >
            Повторить загрузку настроек
          </button>
        ) : (
          <p role="status">Загружаем настройки галереи…</p>
        )
      ) : (
        <>
          <label className="gallery-optin">
            <input
              type="checkbox"
              checked={listed}
              disabled={busy}
              onChange={(e) => void visibility(e.target.checked)}
            />
            Показывать мой ZIN в галерее
          </label>
          {!published && (
            <p>
              Страница ещё не опубликована. Согласие сохранится, но до
              публикации карточка не появится.
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save(false);
            }}
          >
            <label>
              Название ZIN
              <input
                disabled={busy}
                required
                maxLength={80}
                value={value.title}
                onChange={(e) => update({ title: e.target.value })}
              />
            </label>
            <label>
              Краткое описание
              <textarea
                disabled={busy}
                rows={3}
                maxLength={280}
                value={value.description}
                onChange={(e) => update({ description: e.target.value })}
              />
            </label>
            <label>
              Категория
              <select
                disabled={busy}
                aria-label="Категория"
                value={value.category}
                onChange={(e) =>
                  update({
                    category: e.target.value as Presentation["category"],
                  })
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Обложка для галереи
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setBusy(true);
                  setError("");
                  void createGalleryCover(file)
                    .then((cover) => update({ cover }))
                    .catch((error) => setError(cloudError(error)))
                    .finally(() => setBusy(false));
                }}
              />
            </label>
            <p>
              Выберите собственное изображение или файл с разрешением на
              использование. Создадим статичную обложку 480 × 300, до 64 КБ. Это
              обложка автора, а не снимок страницы.
            </p>
            {value.cover && (
              <div className="gallery-cover-edit">
                <img
                  src={value.cover}
                  width={240}
                  height={150}
                  alt="Выбранная обложка"
                />
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => update({ cover: "" })}
                >
                  Убрать обложку
                </button>
              </div>
            )}
            <div className="account-actions">
              <button className="secondary-button" disabled={busy}>
                Сохранить до публикации
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={busy || !published}
                onClick={() => void save(true)}
              >
                Опубликовать представление
              </button>
            </div>
          </form>
          <p>
            Название, описание и обложка обновляются только при публикации
            представления или самой страницы. Согласие действует отдельно;
            модератор может скрыть карточку из каталога.
          </p>
        </>
      )}
      {notice && (
        <p role="status" className="account-notice">
          {notice}
        </p>
      )}
    </section>
  );
}
