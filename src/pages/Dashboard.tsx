import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Brand } from "../components/ui/Brand";
import { useAuth } from "../auth/AuthContext";
import { useCloud } from "../cloud/CloudContext";
import { useProject } from "../state/ProjectContext";
import { usernameError } from "../auth/usernames";
import { cloudError } from "../cloud/errors";
import { downloadBackup, exportProject } from "../model/backup";
export function Dashboard() {
  const auth = useAuth(),
    cloud = useCloud(),
    { project } = useProject();
  const [username, setUsername] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(
    () => setUsername(cloud.profile?.username ?? ""),
    [cloud.profile?.username],
  );
  if (auth.loading)
    return (
      <div className="account-page">
        <p role="status">Проверяем сессию…</p>
      </div>
    );
  if (!auth.session) return <Navigate to="/login?next=/dashboard" replace />;
  const run = async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const completed = await action();
      if (success && completed !== false) setMessage(success);
    } catch (error) {
      setError(cloudError(error));
    } finally {
      setBusy(false);
    }
  };
  const publicPath = cloud.profile ? `/u/${cloud.profile.username}` : "";
  const pendingPublication =
    !!cloud.publication &&
    (cloud.draft?.revision !== cloud.publication.source_revision ||
      cloud.status === "pending" ||
      cloud.status === "saving");
  return (
    <div className="account-page">
      <header>
        <Brand />
        <nav>
          <Link to="/editor">Редактор ↗</Link>
          <button onClick={() => void run(auth.signOut)}>Выйти</button>
        </nav>
      </header>
      <main className="dashboard-main">
        <span className="eyebrow">ВАШ ЛИЧНЫЙ КАБИНЕТ</span>
        <h1>{cloud.profile ? `@${cloud.profile.username}` : "Ваш аккаунт"}</h1>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="account-notice">
            {message}
          </p>
        )}
        {cloud.detail && (
          <p
            role="status"
            className={`account-notice ${cloud.status === "error" || cloud.status === "conflict" ? "notice-error" : ""}`}
          >
            {cloud.detail}
          </p>
        )}
        {cloud.status === "loading" && (
          <p role="status">Загружаем облачный проект…</p>
        )}
        {(cloud.status === "error" || cloud.status === "offline") &&
          !cloud.ready && (
            <button
              className="secondary-button"
              onClick={() => void run(cloud.reconnect)}
            >
              Повторить подключение
            </button>
          )}
        {cloud.status === "conflict" && (
          <section className="account-card">
            <h2>Выберите версию</h2>
            <p>
              В этом браузере есть изменения, которые отличаются от облачного
              черновика. Публикация не менялась. Сначала можно скачать резервную
              копию.
            </p>
            <div className="account-actions">
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() =>
                  void run(async () =>
                    downloadBackup(await exportProject(project)),
                  )
                }
              >
                Экспортировать текущую копию
              </button>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => void run(cloud.reloadRemote)}
              >
                Открыть облачную версию
              </button>
              <button
                className="primary-button"
                disabled={busy}
                onClick={() => void run(cloud.overwriteRemote)}
              >
                Заменить облачный черновик
              </button>
            </div>
          </section>
        )}
        <section className="account-card">
          <div className="dashboard-title">
            <h2>{project.page.title || "Без названия"}</h2>
            <span className="publication-badge">
              {cloud.publication ? "Опубликована" : "Не опубликована"}
            </span>
          </div>
          <p>
            {cloud.status === "saved"
              ? "Черновик подтверждён облаком."
              : cloud.status === "saving"
                ? "Передаём изменения и файлы…"
                : cloud.status === "pending"
                  ? "Новые изменения пока остаются в браузере."
                  : cloud.draft
                    ? "Облачный черновик существует."
                    : "Облачный черновик ещё не создан."}
          </p>
          {pendingPublication && (
            <p>
              Есть неопубликованные изменения. Посетители видят предыдущую
              публикацию.
            </p>
          )}
          {cloud.publication && (
            <p>
              Публичный адрес:{" "}
              <a
                className="public-address"
                href={publicPath}
                target="_blank"
                rel="noopener noreferrer"
              >
                {location.origin}
                {publicPath}
              </a>
            </p>
          )}
          <div className="account-actions">
            <Link className="secondary-button" to="/editor">
              Редактировать
            </Link>
            <Link className="secondary-button" to="/preview">
              Предпросмотр
            </Link>
            <button
              className="secondary-button"
              disabled={busy || cloud.busy || !cloud.ready}
              onClick={() =>
                void run(cloud.save, "Черновик сохранён в облаке.")
              }
            >
              Сохранить в облако
            </button>
            <button
              className="primary-button"
              disabled={busy || cloud.busy || !cloud.ready}
              onClick={() => void run(cloud.publish, "Страница опубликована.")}
            >
              {busy || cloud.busy
                ? "Подождите…"
                : cloud.publication
                  ? "Обновить публикацию"
                  : "Опубликовать"}
            </button>
            {cloud.publication && (
              <button
                className="secondary-button"
                disabled={busy || cloud.busy}
                onClick={() => {
                  if (
                    confirm(
                      "Снять страницу с публикации? Черновик останется в аккаунте.",
                    )
                  )
                    void run(cloud.unpublish, "Страница снята с публикации.");
                }}
              >
                Снять с публикации
              </button>
            )}
          </div>
        </section>
        {cloud.localProject && (
          <section className="account-card">
            <h2>Локальная страница из этого браузера</h2>
            <p>
              «{cloud.localProject.page.title}» ·{" "}
              {cloud.localProject.blocks.length} блоков. Её файлы находятся на
              этом устройстве. Перенос загрузит их в приватное хранилище
              аккаунта и сохранит черновик; публикация выполняется отдельно.
            </p>
            <p>
              Исходная локальная копия не удаляется. Если облачный черновик уже
              существует, замена потребует подтверждения.
            </p>
            <div className="account-actions">
              <button
                className="primary-button"
                disabled={busy || cloud.busy || !cloud.ready}
                onClick={() =>
                  void run(
                    cloud.importLocal,
                    "Перенос проверен. Исходная локальная копия сохранена.",
                  )
                }
              >
                Перенести локальную страницу
              </button>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() =>
                  void run(async () =>
                    downloadBackup(
                      await exportProject(cloud.localProject!),
                      "zin-local-backup.json",
                    ),
                  )
                }
              >
                Скачать локальную копию
              </button>
              {cloud.migrationVerified && (
                <button
                  className="secondary-button"
                  disabled={busy || cloud.busy}
                  onClick={() =>
                    void run(
                      async () => cloud.deleteLocalCopy(),
                      "Локальная структура удалена по вашему запросу. Облачная копия сохранена.",
                    )
                  }
                >
                  Удалить локальную копию после переноса
                </button>
              )}
            </div>
          </section>
        )}
        <section className="account-card">
          <h2>Имя пользователя</h2>
          <p>
            Изменение имени сразу изменит публичный адрес. Старый адрес
            перестанет открываться.
          </p>
          <form
            className="username-form"
            onSubmit={(event) => {
              event.preventDefault();
              const invalid = usernameError(username);
              if (invalid) {
                setError(invalid);
                return;
              }
              if (confirm(`Изменить адрес страницы на /u/${username}?`))
                void run(
                  () => cloud.rename(username),
                  "Имя пользователя изменено.",
                );
            }}
          >
            <label>
              Новое имя пользователя
              <input
                required
                minLength={3}
                maxLength={30}
                value={username}
                onChange={(event) =>
                  setUsername(event.target.value.toLowerCase().trim())
                }
              />
            </label>
            <button
              className="secondary-button"
              disabled={
                busy || !cloud.profile || username === cloud.profile.username
              }
            >
              Изменить имя
            </button>
          </form>
        </section>
        <section className="account-card">
          <h2>Файлы в облаке</h2>
          <p>
            Очистка удаляет приватные файлы старше 7 дней, не используемые
            черновиком и незавершённой публикацией. Публичные копии
            автоматически не удаляются: на их URL могут ссылаться другие
            страницы.
          </p>
          <p>
            Перед очисткой скачайте JSON-копию: файлы из очень старых отменённых
            действий могут понадобиться при их повторе.
          </p>
          <button
            className="secondary-button"
            disabled={busy || cloud.busy || !cloud.ready}
            onClick={() => {
              if (
                confirm(
                  "Удалить неиспользуемые облачные файлы с учётом указанных сроков?",
                )
              )
                void run(async () =>
                  setMessage(`Удалено файлов: ${await cloud.cleanup()}`),
                );
            }}
          >
            Очистить неиспользуемые файлы
          </button>
        </section>
      </main>
    </div>
  );
}
