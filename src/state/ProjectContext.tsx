import { LocalConflict, LocalPersistence } from "../model/localPersistence";
import { isFree } from "../model/placement";
import { switchLayout, cleanGroups } from "../model/creative";
import { positionPatch, moveLayer } from "../model/layers";
import { createId } from "../model/id";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { clampDecoration } from "../model/decoration";
import { addBlock, demoProject } from "../model/defaults";
import { arrange, editBlock, firstFree } from "../model/grid";
import { parseProject, STORAGE_KEY } from "../model/storage";
import type { Block, BlockType, PageSettings, Project } from "../model/types";
import { historyReducer, type History } from "./history";

function load(storageKey: string, fallbackProject?: Project) {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(storageKey);
    return {
      raw,
      project: raw ? parseProject(raw) : (fallbackProject ?? demoProject()),
      error: "",
    };
  } catch (error) {
    return {
      raw,
      project: fallbackProject ?? demoProject(),
      error: `Не удалось восстановить проект: ${error instanceof Error ? error.message : "хранилище недоступно"}. Исходные данные защищены от перезаписи. Откройте восстановление или явно выберите версию.`,
    };
  }
}
interface ProjectStore {
  storageKey: string;
  localConflict: boolean;
  resolveLocal: (choice: "current" | "stored") => void;
  project: Project;
  replace: (project: Project) => void;
  selectedId: string | null;
  selectedIds: string[];
  select: (id: string | null) => void;
  setLayout: (id: string, layout: "grid" | "free") => void;
  showAnimations: boolean;
  setShowAnimations: (value: boolean) => void;
  previewEffect: { id: string; token: number } | null;
  playEffect: (id: string) => void;
  patchSelection: (patch: Partial<Block>) => void;
  change: (update: Project | ((project: Project) => Project)) => void;
  add: (type: BlockType) => void;
  updateBlock: (id: string, patch: Partial<Block>) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  updatePage: (patch: Partial<PageSettings>) => void;
  reorder: (id: string, direction: -1 | 1) => void;
  moveLayer: (
    id: string,
    action: "front" | "back" | "up" | "down" | number,
  ) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveNow: () => boolean;
  status: "saving" | "saved" | "error";
  message: string;
  notify: (message: string) => void;
}
const Context = createContext<ProjectStore | null>(null);
export function ProjectProvider({
  children,
  storageKey = STORAGE_KEY,
  fallbackProject,
  autosave = true,
}: {
  children: ReactNode;
  storageKey?: string;
  fallbackProject?: Project;
  autosave?: boolean;
}) {
  const [initial] = useState(() => load(storageKey, fallbackProject));
  const [persistence] = useState(
    () =>
      new LocalPersistence(
        {
          getItem: (key) => localStorage.getItem(key),
          setItem: (key, value) => localStorage.setItem(key, value),
        },
        storageKey,
        initial.raw,
        createId(),
        !!initial.error,
      ),
  );
  const [localConflict, setLocalConflict] = useState(!!initial.error);
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initial.project,
    future: [],
  } satisfies History);
  const [selection, setSelection] = useState<string[]>([]);
  const [showAnimations, setShowAnimations] = useState(false);
  const [previewEffect, setPreviewEffect] = useState<{
    id: string;
    token: number;
  } | null>(null);
  const selectedId = selection[0] ?? null;
  const select = (id: string | null) => setSelection(id ? [id] : []);
  const [message, notify] = useState(initial.error);
  const [status, setStatus] = useState<"saving" | "saved" | "error">(
    initial.error ? "error" : "saving",
  );
  const [savedProject, setSavedProject] = useState<Project | null>(null);
  const [edited, setEdited] = useState(false);
  const project = history.present;
  const latest = useRef(project),
    canAutosave = useRef(autosave),
    hasEdits = useRef(edited);
  latest.current = project;
  canAutosave.current = autosave;
  hasEdits.current = edited;
  const replace = useCallback((project: Project) => {
    setEdited(true);
    dispatch({ type: "replace", project });
    setSelection([]);
  }, []);
  const change = useCallback(
    (update: Project | ((project: Project) => Project)) => {
      setEdited(true);
      dispatch({
        type: "change",
        update: (p) =>
          cleanGroups(typeof update === "function" ? update(p) : update),
      });
    },
    [],
  );
  const saveNow = useCallback(() => {
    try {
      persistence.write(latest.current);
      setSavedProject(latest.current);
      setLocalConflict(false);
      setStatus("saved");
      return true;
    } catch (error) {
      setStatus("error");
      if (error instanceof LocalConflict) {
        setLocalConflict(true);
        notify(error.message);
      } else
        notify(
          "Не удалось сохранить: хранилище браузера недоступно или переполнено. Экспортируйте проект в JSON.",
        );
      return false;
    }
  }, [persistence]);
  useEffect(() => {
    if (!autosave || (initial.error && !edited)) return;
    setStatus("saving");
    const timer = window.setTimeout(saveNow, 350);
    return () => clearTimeout(timer);
  }, [project, saveNow, initial.error, edited, autosave]);
  useEffect(() => {
    const flush = () => {
      if (canAutosave.current && (!initial.error || hasEdits.current))
        return saveNow();
      return true;
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (!flush() && hasEdits.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const changed = (event: StorageEvent) => {
      if (
        event.storageArea !== localStorage ||
        (event.key !== storageKey && event.key !== null)
      )
        return;
      try {
        if (!persistence.changed()) return;
      } catch {
        /* report below */
      }
      setLocalConflict(true);
      setStatus("error");
      notify(new LocalConflict().message);
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", unload);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("storage", changed);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("storage", changed);
      flush();
    };
  }, [saveNow, persistence, storageKey, initial.error]);
  const resolveLocal = (choice: "current" | "stored") => {
    if (
      !confirm(
        choice === "current"
          ? "Сохранить текущую версию вместо версии другой вкладки? Предыдущая версия останется в восстановлении. Рекомендуем также экспортировать JSON."
          : "Открыть версию из хранилища? Текущая композиция останется в восстановлении.",
      )
    )
      return;
    try {
      if (choice === "current") {
        persistence.write(project, true);
        setSavedProject(project);
      } else {
        try {
          persistence.write(project);
        } catch (error) {
          if (!(error instanceof LocalConflict)) throw error;
        }
        const raw = persistence.current();
        if (!raw)
          throw new Error(
            "В хранилище нет проекта. Сохраните текущую версию или импортируйте JSON.",
          );
        const stored = parseProject(raw);
        persistence.adopt(raw);
        replace(stored);
      }
      setLocalConflict(false);
      setStatus("saved");
      notify("Версия выбрана. Резервные копии доступны через восстановление.");
    } catch {
      setStatus("error");
      notify(
        "Не удалось выбрать версию. Скачайте JSON или исходные данные через восстановление и освободите место в браузере.",
      );
    }
  };
  const add = (type: BlockType) => {
    if (project.blocks.length >= 200) {
      notify("Максимум 200 блоков на странице.");
      return;
    }
    const result = addBlock(project, type);
    if (project.blocks.some((b) => b.layer !== undefined))
      result.project.blocks = result.project.blocks.map((b) =>
        b.id === result.id ? { ...b, layer: project.blocks.length } : b,
      );
    change(moveLayer(result.project, result.id, "front"));
    select(result.id);
  };
  const remove = (id: string) => {
    if (
      project.blocks.find((b) => b.id === id)?.locked &&
      !confirm("Удалить закреплённый элемент?")
    )
      return;
    change((p) => ({ ...p, blocks: p.blocks.filter((b) => b.id !== id) }));
    if (selectedId === id) select(null);
  };
  const duplicate = (id: string) => {
    if (project.blocks.length >= 200) {
      notify("Максимум 200 блоков на странице.");
      return;
    }
    const source = project.blocks.find((b) => b.id === id);
    if (!source) return;
    let copy: Block = {
      ...source,
      id: createId(),
      name: `${source.name} — копия`,
      ...(source.locked ? { locked: false } : {}),
      ...(project.blocks.some((b) => b.layer !== undefined)
        ? { layer: project.blocks.length }
        : {}),
      x: source.x + 20,
      y: source.y + 20,
    };
    delete copy.groupId;
    if (isFree(copy))
      copy.zIndex =
        Math.max(
          0,
          ...project.blocks
            .filter((b) => b.type === "decoration")
            .map((b) => b.zIndex),
        ) + 1;
    else
      copy = firstFree(
        copy,
        project.blocks.filter((b) => !isFree(b)),
        project.page.columns,
      );
    change(
      moveLayer(
        {
          ...project,
          blocks: [
            ...project.blocks,
            clampDecoration(copy, project.page.maxWidth),
          ],
        },
        copy.id,
        "front",
      ),
    );
    select(copy.id);
  };
  const reorder = (id: string, direction: -1 | 1) =>
    change((p) => moveLayer(p, id, direction === 1 ? "up" : "down"));
  return (
    <Context.Provider
      value={{
        project,
        storageKey,
        localConflict,
        resolveLocal,
        showAnimations,
        setShowAnimations,
        previewEffect,
        playEffect: (id) => setPreviewEffect({ id, token: Date.now() }),
        replace,
        selectedId: project.blocks.some((b) => b.id === selectedId)
          ? selectedId
          : null,
        selectedIds: selection.filter((id) =>
          project.blocks.some((b) => b.id === id),
        ),
        select,
        setLayout: (id, layout) => change((p) => switchLayout(p, id, layout)),
        patchSelection: (patch) =>
          change((p) => ({
            ...p,
            blocks: p.blocks.map((b) =>
              selection.includes(b.id)
                ? { ...b, ...positionPatch(b, patch), id: b.id, type: b.type }
                : b,
            ),
          })),
        change,
        add,
        updateBlock: (id, patch) => change((p) => editBlock(p, id, patch)),
        remove,
        duplicate,
        reorder,
        moveLayer: (id, action) => change((p) => moveLayer(p, id, action)),
        updatePage: (patch) => {
          if (
            patch.columns &&
            project.blocks.some(
              (b) =>
                b.locked && !isFree(b) && b.col + b.colSpan > patch.columns!,
            )
          ) {
            notify(
              "Сначала разблокируйте элементы, которые не помещаются в новое число колонок.",
            );
            return;
          }
          change((p) => ({
            ...p,
            page: { ...p.page, ...patch },
            blocks: arrange(
              p.blocks.map((b) =>
                clampDecoration(b, patch.maxWidth ?? p.page.maxWidth),
              ),
              patch.columns ?? p.page.columns,
            ),
          }));
        },
        undo: () => {
          setEdited(true);
          dispatch({ type: "undo" });
        },
        redo: () => {
          setEdited(true);
          dispatch({ type: "redo" });
        },
        canUndo: !!history.past.length,
        canRedo: !!history.future.length,
        saveNow,
        status:
          status === "error"
            ? "error"
            : savedProject === project
              ? "saved"
              : "saving",
        message,
        notify,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useProject() {
  const value = useContext(Context);
  if (!value) throw new Error("ProjectProvider missing");
  return value;
}
