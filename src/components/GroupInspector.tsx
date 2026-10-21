import { useProject } from "../state/ProjectContext";
import { selectionBox } from "../model/creative";
import { Field, NumberField } from "./Fields";
export function GroupInspector() {
  const {
    project,
    selectedIds,
    renameGroup,
    transform,
    patchSelection,
    selectOnly,
    moveLayer,
  } = useProject();
  const chosen = project.blocks.filter((b) => selectedIds.includes(b.id)),
    id = chosen[0]?.groupId;
  const group = project.groups?.find(
    (g) => g.id === id && chosen.every((b) => b.groupId === g.id),
  );
  const box = selectionBox(project, selectedIds);
  if (!box) return null;
  const patch = (data: Partial<typeof box>) =>
    transform(selectedIds, box, { ...box, ...data });
  return (
    <div className="inspector-fields">
      <h3>
        {group ? "Группа" : "Выделение"} · {chosen.length} элементов
      </h3>
      {group && (
        <Field label="Название группы">
          <input
            maxLength={160}
            value={group.name}
            onChange={(e) => renameGroup(group.id, e.target.value)}
          />
        </Field>
      )}
      <p className="muted caption">
        Группы масштабируются пропорционально. Геометрия участников сохраняется
        в координатах полотна.
      </p>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={chosen.every((b) => b.locked)}
          onChange={(e) => patchSelection({ locked: e.target.checked })}
        />
        Закрепить группу
      </label>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={chosen.every((b) => b.hidden)}
          onChange={(e) => patchSelection({ hidden: e.target.checked })}
        />
        Скрыть группу
      </label>
      <fieldset className="geometry-fields" disabled={box.locked}>
        <NumberField
          label="X группы"
          value={Math.round(box.x)}
          min={-1000000}
          max={1000000}
          onChange={(x) => patch({ x })}
        />
        <NumberField
          label="Y группы"
          value={Math.round(box.y)}
          min={-1000000}
          max={1000000}
          onChange={(y) => patch({ y })}
        />
        <NumberField
          label="Ширина группы"
          value={Math.round(box.width)}
          min={24}
          max={100000}
          onChange={(width) =>
            patch({ width, height: (box.height * width) / box.width })
          }
        />
        <NumberField
          label="Высота группы"
          value={Math.round(box.height)}
          min={24}
          max={100000}
          onChange={(height) =>
            patch({ height, width: (box.width * height) / box.height })
          }
        />
        <NumberField
          label="Повернуть группу на, °"
          value={0}
          min={-360}
          max={360}
          onChange={(rotation) => patch({ rotation })}
        />
      </fieldset>
      <div className="layer-commands">
        {(["front", "up", "down", "back"] as const).map((action, i) => (
          <button key={action} onClick={() => moveLayer(chosen[0].id, action)}>
            {
              [
                "На передний план",
                "На уровень выше",
                "На уровень ниже",
                "На задний план",
              ][i]
            }
          </button>
        ))}
      </div>
      <h3>Редактировать участника</h3>
      {chosen.map((b) => (
        <button
          key={b.id}
          className="secondary-button"
          onClick={() => selectOnly(b.id)}
        >
          {b.name}
        </button>
      ))}
    </div>
  );
}
