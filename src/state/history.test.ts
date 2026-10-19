import { expect, it } from 'vitest';
import { emptyProject } from '../model/defaults';
import { historyReducer, type History } from './history';
it('undoes and redoes geometry and discards redo after a new edit', () => {
  const initial: History = { past: [], present: emptyProject(), future: [] };
  const changed = historyReducer(initial, { type: 'change', update: p => ({ ...p, page: { ...p.page, columns: 3 } }) });
  expect(changed.present.page.columns).toBe(3);
  const undone = historyReducer(changed, { type: 'undo' });
  expect(undone.present.page.columns).toBe(4);
  expect(historyReducer(undone, { type: 'redo' }).present.page.columns).toBe(3);
  expect(historyReducer(undone, { type: 'change', update: p => ({ ...p, blocks: [], page: { ...p.page, title: 'Новое' } }) }).future).toEqual([]);
});
