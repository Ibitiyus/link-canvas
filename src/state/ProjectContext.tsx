import { moveLayer } from "../model/layers";
import { createId } from "../model/id";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
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
  try {
    return {
      project: localStorage.getItem(storageKey)
        ? parseProject(localStorage.getItem(storageKey)!)
        : (fallbackProject ?? demoProject()),
      error: "",
    };
  } catch (error) {
    return {
      project: demoProject(),
      error: `Не удалось восстановить проект: ${error instanceof Error ? error.message : "хранилище недоступно"}. Исходные данные не перезаписаны до первого изменения.`,
    };
  }
}
interface ProjectStore {
  project: Project;
  replace: (project: Project) => void;
  selectedId: string | null;
  select: (id: string | null) => void;
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
}: {
  children: ReactNode;
  storageKey?: string;
  fallbackProject?: Project;
}) {
  const [initial] = useState(() => load(storageKey, fallbackProject));
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initial.project,
    future: [],
  } satisfies History);
  const [selectedId, select] = useState<string | null>(null);
  const [message, notify] = useState(initial.error);
  const [status, setStatus] = useState<"saving" | "saved" | "error">(
    initial.error ? "error" : "saving",
  );
  const [edited, setEdited] = useState(false);
  const project = history.present;
  const replace = useCallback((project: Project) => {
    setEdited(true);
    dispatch({ type: "replace", project });
    select(null);
  }, []);
  const change = useCallback(
    (update: Project | ((project: Project) => Project)) => {
      setEdited(true);
      dispatch({ type: "change", update });
    },
    [],
  );
  const saveNow = useCallback(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(project));
      setStatus("saved");
      return true;
    } catch {
      setStatus("error");
      notify(
        "Не удалось сохранить: хранилище браузера недоступно или переполнено. Экспортируйте проект в JSON.",
      );
      return false;
    }
  }, [project, storageKey]);
  useEffect(() => {
    if (initial.error && !edited) return;
    setStatus("saving");
    const timer = window.setTimeout(saveNow, 350);
    // Flush this exact version before the next change, navigation or unmount.
    const flush = () => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(project));
      } catch {
        /* saveNow reports errors */
      }
    };
    window.addEventListener("pagehide", flush);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [project, saveNow, initial.error, edited, storageKey]);
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
    if (copy.type === "decoration")
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
        project.blocks.filter((b) => b.type !== "decoration"),
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
        replace,
        selectedId: project.blocks.some((b) => b.id === selectedId)
          ? selectedId
          : null,
        select,
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
                b.locked &&
                b.type !== "decoration" &&
                b.col + b.colSpan > patch.columns!,
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
        status,
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
