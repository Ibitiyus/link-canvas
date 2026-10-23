import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, Flag, Search, RefreshCw } from "lucide-react";
import { Brand } from "../components/ui/Brand";
import { useAuth } from "../auth/AuthContext";
import { ownerClient, cloudConfigured } from "../cloud/config";
import { cloudError } from "../cloud/errors";
import { searchGallery } from "../explore/api";
import {
  CATEGORIES,
  type ExploreSort,
  type GalleryCard,
} from "../explore/model";
import { useExploreMetadata } from "../explore/metadata";
import "../styles/explore.css";
function Cover({ card }: { card: GalleryCard }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [card.cover]);
  return (
    <div
      className={`explore-cover cover-${CATEGORIES.indexOf(card.category) % 4}`}
    >
      {card.cover && !failed ? (
        <img
          src={card.cover}
          alt={`Обложка автора: ${card.title}`}
          loading="lazy"
          decoding="async"
          width={480}
          height={300}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="explore-type-cover" aria-hidden="true">
          <span>ZIN / {card.category}</span>
          <strong>{card.title}</strong>
          <span>@{card.username} ↗</span>
        </div>
      )}
      <span className="explore-cover-label">
        {card.cover && !failed ? "ОБЛОЖКА АВТОРА" : "БЕЗ ОБЛОЖКИ"}
      </span>
    </div>
  );
}
function Report({ username, close }: { username: string; close: () => void }) {
  const { session } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("spam"),
    [details, setDetails] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="explore-report"
      aria-labelledby="report-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <h2 id="report-title">Сообщить о @{username}</h2>
      {!session ? (
        <>
          <p>
            Для защиты от спама отправить жалобу можно после входа. Контактные
            данные не публикуются и не передаются автору страницы.
          </p>
          <Link className="primary-button" to="/login?next=/explore">
            Войти
          </Link>
        </>
      ) : sent ? (
        <p role="status">
          Жалоба принята. Она доступна только модератору; автоматического
          скрытия страницы нет.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            void Promise.resolve(
              ownerClient(session.user.id).rpc("report_explore", {
                page_username: username,
                report_reason: reason,
                report_details: details,
              }),
            )
              .then(({ error }) => {
                if (error) throw error;
                setSent(true);
              })
              .catch((error) => setError(cloudError(error)))
              .finally(() => setBusy(false));
          }}
        >
          <label>
            Причина
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="spam">Спам</option>
              <option value="unsafe">Опасный или недопустимый контент</option>
              <option value="rights">Нарушение прав</option>
              <option value="other">Другое</option>
            </select>
          </label>
          <label>
            Подробности (необязательно)
            <textarea
              maxLength={500}
              rows={4}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Не указывайте пароли и личные данные"
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button className="primary-button" disabled={busy}>
            {busy ? "Отправляем…" : "Отправить жалобу"}
          </button>
        </form>
      )}
      <button type="button" className="secondary-button" onClick={close}>
        Закрыть
      </button>
    </dialog>
  );
}
export default function Explore() {
  useExploreMetadata();
  const { session } = useAuth();
  const [params, setParams] = useSearchParams();
  const query = params.get("q")?.slice(0, 100) ?? "",
    category = CATEGORIES.includes(params.get("category") as never)
      ? params.get("category")!
      : "",
    sort: ExploreSort = ["new", "updated", "random"].includes(
      params.get("sort") ?? "",
    )
      ? (params.get("sort") as ExploreSort)
      : "new";
  const [input, setInput] = useState(query),
    [debounced, setDebounced] = useState(query),
    [cards, setCards] = useState<GalleryCard[]>([]),
    [offset, setOffset] = useState(0),
    [next, setNext] = useState(0),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [report, setReport] = useState("");
  const [seed, setSeed] = useState(() => Math.random().toString(36).slice(2));
  const update = (patch: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) p.set(key, value);
      else p.delete(key);
    }
    setParams(p, { replace: true });
  };
  useEffect(() => {
    setInput(query);
    const timer = setTimeout(() => setDebounced(query), 350);
    return () => clearTimeout(timer);
  }, [query]);
  const requestKey = `${debounced}\n${category}\n${sort}\n${seed}`;
  const lastKey = useRef("");
  const reportTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const changed = lastKey.current !== requestKey;
    if (changed) {
      lastKey.current = requestKey;
      setOffset(0);
      setCards([]);
      setMore(false);
    }
    const pageOffset = changed ? 0 : offset;
    // Offset reset schedules a new effect; avoid issuing the first page twice.
    if (changed && offset !== 0) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void searchGallery(
      debounced,
      category,
      sort,
      pageOffset,
      seed,
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        setCards((current) =>
          pageOffset === 0
            ? result.items
            : [
                ...current,
                ...result.items.filter(
                  (item) => !current.some((c) => c.username === item.username),
                ),
              ],
        );
        setMore(result.has_more);
        setNext(result.next_offset);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            cloudConfigured
              ? cloudError(error)
              : "Галерея пока не подключена к облаку. Редактор и локальные проекты доступны.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [requestKey, offset, retry]);
  return (
    <div className="explore-page">
      <a className="skip-link" href="#explore-main">
        К галерее
      </a>
      <header className="explore-nav">
        <Brand />
        <nav aria-label="Основная навигация">
          <Link to="/templates">Шаблоны</Link>
          <Link to="/editor">Создать ZIN ↗</Link>
          <Link to="/dashboard">{session ? "Мой аккаунт" : "Войти"}</Link>
        </nav>
      </header>
      <main id="explore-main">
        <section className="explore-intro">
          <span className="eyebrow">НЕЗАВИСИМЫЕ ЦИФРОВЫЕ МИРЫ / EXPLORE</span>
          <h1>
            ЧУЖОЙ МИР.
            <br />
            <em>ТВОЁ ВДОХНОВЕНИЕ.</em>
          </h1>
          <p>
            Откройте ZIN авторов, которые решили поделиться своей страницей. Без
            рейтингов. Просто творчество.
          </p>
        </section>
        <section className="explore-controls" aria-label="Поиск и фильтры">
          <label className="explore-search">
            <Search size={20} aria-hidden="true" />
            <span className="sr-only">
              Поиск по нику, названию или описанию
            </span>
            <input
              type="search"
              maxLength={100}
              placeholder="Ник, название, настроение…"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                update({ q: e.target.value });
              }}
            />
          </label>
          <label>
            Категория
            <select
              aria-label="Категория"
              value={category}
              onChange={(e) => update({ category: e.target.value })}
            >
              <option value="">Все категории</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Сортировка
            <select
              aria-label="Сортировка"
              value={sort}
              onChange={(e) => update({ sort: e.target.value })}
            >
              <option value="new">Новые</option>
              <option value="updated">Недавно обновлённые</option>
              <option value="random">Случайные</option>
            </select>
          </label>
          {sort === "random" && (
            <button
              className="secondary-button"
              aria-label="Перемешать страницы"
              onClick={() => setSeed(Math.random().toString(36).slice(2))}
            >
              <RefreshCw size={18} />
            </button>
          )}
        </section>
        {error && (
          <div className="explore-empty" role="alert">
            <p>{error}</p>
            <button
              className="secondary-button"
              onClick={() => setRetry((n) => n + 1)}
            >
              Повторить
            </button>
          </div>
        )}
        {!loading && !error && cards.length === 0 && (
          <div className="explore-empty">
            <span className="eyebrow">ПОКА ТИХО</span>
            <h2>
              {query || category
                ? "Ничего не найдено"
                : "Эта галерея начинается с вас"}
            </h2>
            <p>
              {query || category
                ? "Попробуйте другой запрос или категорию."
                : "Здесь появятся реальные опубликованные ZIN. Участие авторов добровольное."}
            </p>
            {query || category ? (
              <button
                className="secondary-button"
                onClick={() => setParams({})}
              >
                Сбросить фильтры
              </button>
            ) : (
              <Link className="primary-button" to="/editor">
                Создать свой ZIN ↗
              </Link>
            )}
          </div>
        )}
        <div
          className="explore-grid"
          aria-label="Опубликованные ZIN"
          aria-busy={loading}
        >
          {cards.map((card) => (
            <article
              className="explore-card"
              key={card.username}
              data-username={card.username}
            >
              <Link to={`/u/${card.username}`} className="explore-card-main">
                <Cover card={card} />
                <div className="explore-card-info">
                  <div className="explore-card-meta">
                    <span>{card.category}</span>
                    <time dateTime={card.updated_at}>
                      {new Intl.DateTimeFormat("ru-RU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }).format(new Date(card.updated_at))}
                    </time>
                  </div>
                  <h2>
                    {card.title}
                    <ArrowUpRight aria-hidden="true" />
                  </h2>
                  <span className="explore-author">@{card.username}</span>
                  {card.description && <p>{card.description}</p>}
                </div>
              </Link>
              <button
                className="explore-report-button"
                aria-label={`Сообщить о странице @${card.username}`}
                onClick={(event) => {
                  reportTrigger.current = event.currentTarget;
                  setReport(card.username);
                }}
              >
                <Flag size={14} />
                Сообщить
              </button>
            </article>
          ))}
        </div>
        {loading && (
          <p className="explore-loading" role="status">
            Открываем миры…
          </p>
        )}
        {more && !error && (
          <button
            className="secondary-button explore-more"
            disabled={loading}
            onClick={() => setOffset(next)}
          >
            Показать ещё
          </button>
        )}
      </main>
      <footer className="explore-footer">
        <span>ОДИН ZIN. СВОЙ МИР.</span>
        <Link to="/dashboard">Добавить страницу в галерею ↗</Link>
      </footer>
      {report && (
        <Report
          username={report}
          close={() => {
            setReport("");
            requestAnimationFrame(() => reportTrigger.current?.focus());
          }}
        />
      )}
    </div>
  );
}
