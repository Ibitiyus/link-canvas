import { isFree } from "../model/placement";
import {
  switchLayout,
  groupBlocks,
  ungroupBlocks,
  transformSelection,
  duplicateSelection,
  cleanGroups,
} from "../model/creative";
import { positionPatch, moveLayer } from "../model/layers";
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
  selectedIds: string[];
  multiSelect: boolean;
  setMultiSelect: (value: boolean) => void;
  select: (id: string | null, additive?: boolean) => void;
  selectOnly: (id: string) => void;
  setLayout: (id: string, layout: "grid" | "free") => void;
  groupSelection: () => void;
  ungroup: (id: string) => void;
  renameGroup: (id: string, name: string) => void;
  patchSelection: (patch: Partial<Block>) => void;
  transform: (ids: string[], from: Block, to: Block) => void;
  duplicateSelected: () => void;
  removeSelected: () => void;
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
  const [selection, setSelection] = useState<string[]>([]),
    [multiSelect, setMultiSelect] = useState(false);
  const selectedId = selection[0] ?? null;
  const select = (id: string | null, additive = false) => {
    if (!id) {
      setSelection([]);
      return;
    }
    const source = history.present.blocks.find((b) => b.id === id);
    const ids = source?.groupId
      ? history.present.blocks
          .filter((b) => b.groupId === source.groupId)
          .map((b) => b.id)
      : [id];
    setSelection((current) => {
      if (!additive) return ids;
      return ids.every((i) => current.includes(i))
        ? current.filter((i) => !ids.includes(i))
        : [...new Set([...current, ...ids])];
    });
  };
  const [message, notify] = useState(initial.error);
  const [status, setStatus] = useState<"saving" | "saved" | "error">(
    initial.error ? "error" : "saving",
  );
  const [savedProject,setSavedProject]=useState<Project|null>(null);
  const [edited, setEdited] = useState(false);
  const project = history.present;
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
      localStorage.setItem(storageKey, JSON.stringify(project));
      setSavedProject(project);
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
        replace,
        selectedId: project.blocks.some((b) => b.id === selectedId)
          ? selectedId
          : null,
        selectedIds: selection.filter((id) =>
          project.blocks.some((b) => b.id === id),
        ),
        multiSelect,
        setMultiSelect,
        select,
        selectOnly: (id) => setSelection([id]),
        setLayout: (id, layout) => change((p) => switchLayout(p, id, layout)),
        groupSelection: () => {
          if (selection.length < 2) return;
          if (
            project.blocks.some((b) => selection.includes(b.id) && b.locked)
          ) {
            notify("Сначала разблокируйте выбранные элементы.");
            return;
          }
          const result = groupBlocks(project, selection);
          if (result === project)
            notify(
              "Не удалось создать группу. Допускается не более 100 групп.",
            );
          else change(result);
        },
        ungroup: (id) => change((p) => ungroupBlocks(p, id)),
        renameGroup: (id, name) =>
          change((p) => ({
            ...p,
            groups: p.groups?.map((g) =>
              g.id === id ? { ...g, name: name.slice(0, 160) } : g,
            ),
          })),
        patchSelection: (patch) =>
          change((p) => ({
            ...p,
            blocks: p.blocks.map((b) =>
              selection.includes(b.id)
                ? { ...b, ...positionPatch(b, patch), id: b.id, type: b.type }
                : b,
            ),
          })),
        transform: (ids, from, to) => {
          const result = transformSelection(project, ids, from, to);
          if (result === project && !from.locked)
            notify(
              "Размер группы выходит за допустимые размеры элементов или шрифта (8–144 пкс).",
            );
          else change(result);
        },
        duplicateSelected: () => {
          const result = duplicateSelection(project, selection);
          if (!result.ids.length) {
            notify(
              "Нельзя добавить копию: предел — 200 элементов и 100 групп.",
            );
            return;
          }
          change(result.project);
          setSelection(result.ids);
        },
        removeSelected: () => {
          if (
            project.blocks.some((b) => selection.includes(b.id) && b.locked) &&
            !confirm("Удалить закреплённые элементы?")
          )
            return;
          change((p) => ({
            ...p,
            blocks: p.blocks.filter((b) => !selection.includes(b.id)),
          }));
          setSelection([]);
        },
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
        status:status==="error"?"error":savedProject===project?"saved":"saving",
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
