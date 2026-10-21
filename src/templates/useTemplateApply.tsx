import { projectSnapshot } from "../cloud/snapshot";
import { accountProjectKey } from "../cloud/CloudContext";
import { parseProject, STORAGE_KEY } from "../model/storage";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useProject } from "../state/ProjectContext";
import { useCloud } from "../cloud/CloudContext";
import { downloadBackup, exportProject } from "../model/backup";
import type { Project } from "../model/types";
import { saveTemplate } from "./storage";
export function useTemplateApply() {
  const { project, change, select, notify } = useProject(),
    { session } = useAuth(),
    { ready } = useCloud(),
    navigate = useNavigate();
  const [pending, setPending] = useState<{
      name: string;
      load: () => Promise<Project>;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const baseline = useRef<string | null>(null);
  useEffect(() => {
    try {
      baseline.current = localStorage.getItem(
        session?.user.id ? accountProjectKey(session.user.id) : STORAGE_KEY,
      );
    } catch {
      /* Applying reports unavailable storage. */
    }
  }, [session?.user.id]);
  const dialog = useRef<HTMLDialogElement>(null),
    current = useRef(project),
    owner = useRef(session?.user.id);
  current.current = project;
  owner.current = session?.user.id;
  useEffect(() => {
    if (pending) dialog.current?.showModal();
  }, [pending]);
  const apply = async () => {
    if (!pending) return;
    const original = current.current,
      identity = owner.current;
    setBusy(true);
    setError("");
    try {
      const checkStored = () => {
        const raw = localStorage.getItem(
          identity ? accountProjectKey(identity) : STORAGE_KEY,
        );
        // Validate even unchanged raw data: a damaged draft must never be backed up as the demo fallback.
        const stored = raw ? parseProject(raw) : null;
        if (
          raw !== baseline.current &&
          stored &&
          projectSnapshot(stored) !== projectSnapshot(original)
        )
          throw new Error(
            "Черновик изменён в другой вкладке. Обновите страницу перед заменой.",
          );
      };
      checkStored();
      if (identity && !ready)
        throw new Error(
          "Дождитесь загрузки облачного черновика или разрешите конфликт в личном кабинете.",
        );
      const next = await pending.load();
      if (
        !mounted.current ||
        identity !== owner.current ||
        current.current !== original
      )
        throw new Error(
          "Страница или аккаунт изменились. Повторите выбор шаблона.",
        );
      checkStored();
      await saveTemplate(original, "До замены шаблоном", true);
      if (
        !mounted.current ||
        identity !== owner.current ||
        current.current !== original
      )
        throw new Error(
          "Текущая страница или аккаунт изменились. Повторите выбор шаблона.",
        );
      checkStored();
      change(next);
      select(null);
      setPending(null);
      notify(
        "Шаблон применён. Предыдущая страница доступна в резервной копии и через отмену.",
      );
      navigate("/editor");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось применить шаблон.");
    } finally {
      setBusy(false);
    }
  };
  return {
    choose: (name: string, load: () => Promise<Project>) => {
      setError("");
      setPending({ name, load });
    },
    dialog: pending && (
      <dialog
        ref={dialog}
        className="template-dialog"
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setPending(null);
        }}
      >
        <h2>Использовать «{pending.name}»?</h2>
        <p>
          Текущая страница будет заменена. Сначала сохраним её резервную копию в
          этом браузере. Изменение можно отменить в редакторе.
        </p>
        {session && (
          <p>
            После подтверждения новый проект попадёт в облачный черновик через
            автосохранение. Опубликованная страница изменится только при
            отдельной публикации.
          </p>
        )}
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              downloadBackup(await exportProject(current.current));
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Не удалось экспортировать.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Скачать текущий JSON
        </button>
        {error && <p role="alert">{error}</p>}
        <div className="template-dialog-actions">
          <button disabled={busy} onClick={() => setPending(null)}>
            Отмена
          </button>
          <button className="primary-button" disabled={busy} onClick={apply}>
            {busy ? "Подготавливаем…" : "Заменить страницу"}
          </button>
        </div>
      </dialog>
    ),
  };
}
