import type { Project } from "../model/types";
export interface History {
  past: Project[];
  present: Project;
  future: Project[];
}
export type HistoryAction =
  | { type: "replace"; project: Project }
  | { type: "change"; update: Project | ((project: Project) => Project) }
  | { type: "undo" }
  | { type: "redo" };
export function historyReducer(state: History, action: HistoryAction): History {
  if (action.type === "replace") return { past: [], present: action.project, future: [] };
  if (action.type === "undo") {
    if (!state.past.length) return state;
    return {
      past: state.past.slice(0, -1),
      present: state.past.at(-1)!,
      future: [state.present, ...state.future],
    };
  }
  if (action.type === "redo") {
    if (!state.future.length) return state;
    return {
      past: [...state.past, state.present],
      present: state.future[0],
      future: state.future.slice(1),
    };
  }
  const present =
    typeof action.update === "function"
      ? action.update(state.present)
      : action.update;
  if (JSON.stringify(present) === JSON.stringify(state.present)) return state;
  return {
    past: [...state.past.slice(-59), state.present],
    present,
    future: [],
  };
}
