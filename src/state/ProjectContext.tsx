import { createContext, useCallback, useContext, useEffect, useReducer, useState, type ReactNode } from 'react';
import { addBlock, demoProject } from '../model/defaults';
import { arrange, editBlock, firstFree } from '../model/grid';
import { readProject, writeProject } from '../model/storage';
import type { Block, BlockType, PageSettings, Project } from '../model/types';
import { historyReducer, type History } from './history';

function load() {
  try { return { project: readProject(localStorage) ?? demoProject(), error: '' }; }
  catch (error) { return { project: demoProject(), error: `Не удалось восстановить проект: ${error instanceof Error ? error.message : 'хранилище недоступно'}. Исходные данные не перезаписаны до первого изменения.` }; }
}
interface ProjectStore {
  project: Project; selectedId: string | null; select: (id: string | null) => void;
  change: (update: Project | ((project: Project) => Project)) => void;
  add: (type: BlockType) => void; updateBlock: (id: string, patch: Partial<Block>) => void;
  remove: (id: string) => void; duplicate: (id: string) => void;
  updatePage: (patch: Partial<PageSettings>) => void; reorder: (id: string, direction: -1 | 1) => void;
  undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean;
  saveNow: () => boolean; status: 'saving' | 'saved' | 'error'; message: string; notify: (message: string) => void;
}
const Context = createContext<ProjectStore | null>(null);
export function ProjectProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(load);
  const [history, dispatch] = useReducer(historyReducer, { past: [], present: initial.project, future: [] } satisfies History);
  const [selectedId, select] = useState<string | null>(null);
  const [message, notify] = useState(initial.error);
  const [status, setStatus] = useState<'saving' | 'saved' | 'error'>(initial.error ? 'error' : 'saving');
  const [edited, setEdited] = useState(false);
  const project = history.present;
  const change = useCallback((update: Project | ((project: Project) => Project)) => { setEdited(true); dispatch({ type: 'change', update }); }, []);
  const saveNow = useCallback(() => {
    try { writeProject(localStorage, project); setStatus('saved'); return true; }
    catch { setStatus('error'); notify('Не удалось сохранить: хранилище браузера недоступно или переполнено. Экспортируйте проект в JSON.'); return false; }
  }, [project]);
  useEffect(() => {
    if (initial.error && !edited) return;
    setStatus('saving');
    const timer = window.setTimeout(saveNow, 350);
    // Flush this exact version before the next change, navigation or unmount.
    const flush = () => { try { writeProject(localStorage, project); } catch { /* saveNow reports errors */ } };
    window.addEventListener('pagehide', flush);
    return () => { clearTimeout(timer); window.removeEventListener('pagehide', flush); flush(); };
  }, [project, saveNow, initial.error, edited]);
  const add = (type: BlockType) => {
    if (project.blocks.length >= 200) { notify('Максимум 200 блоков на странице.'); return; }
    const result = addBlock(project, type); change(result.project); select(result.id);
  };
  const remove = (id: string) => { change(p => ({ ...p, blocks: p.blocks.filter(b => b.id !== id) })); if (selectedId === id) select(null); };
  const duplicate = (id: string) => {
    if (project.blocks.length >= 200) { notify('Максимум 200 блоков на странице.'); return; }
    const source = project.blocks.find(b => b.id === id); if (!source) return;
    let copy: Block = { ...source, id: crypto.randomUUID(), name: `${source.name} — копия`, x: source.x + 20, y: source.y + 20 };
    if (copy.type === 'decoration') copy.zIndex = Math.max(0, ...project.blocks.filter(b => b.type === 'decoration').map(b => b.zIndex)) + 1;
    else copy = firstFree(copy, project.blocks.filter(b => b.type !== 'decoration'), project.page.columns);
    change({ ...project, blocks: [...project.blocks, copy] }); select(copy.id);
  };
  const reorder = (id: string, direction: -1 | 1) => change(p => {
    const layers = p.blocks.filter(b => b.type === 'decoration').sort((a, b) => a.zIndex - b.zIndex);
    const index = layers.findIndex(b => b.id === id), target = index + direction;
    if (index < 0 || target < 0 || target >= layers.length) return p;
    [layers[index], layers[target]] = [layers[target], layers[index]];
    const z = new Map(layers.map((block, i) => [block.id, i + 1]));
    return { ...p, blocks: p.blocks.map(b => z.has(b.id) ? { ...b, zIndex: z.get(b.id)! } : b) };
  });
  return <Context.Provider value={{ project, selectedId: project.blocks.some(b => b.id === selectedId) ? selectedId : null, select, change, add,
    updateBlock: (id, patch) => change(p => editBlock(p, id, patch)), remove, duplicate, reorder,
    updatePage: patch => change(p => ({ ...p, page: { ...p.page, ...patch }, blocks: arrange(p.blocks, patch.columns ?? p.page.columns) })),
    undo: () => { setEdited(true); dispatch({ type: 'undo' }); }, redo: () => { setEdited(true); dispatch({ type: 'redo' }); },
    canUndo: !!history.past.length, canRedo: !!history.future.length, saveNow, status, message, notify }}>{children}</Context.Provider>;
}
export function useProject() { const value = useContext(Context); if (!value) throw new Error('ProjectProvider missing'); return value; }
