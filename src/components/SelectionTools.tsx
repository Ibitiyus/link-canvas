import { useProject } from "../state/ProjectContext";
export function SelectionTools() {
  const {
    project,
    selectedIds,
    multiSelect,
    setMultiSelect,
    groupSelection,
    ungroup,
    patchSelection,
    duplicateSelected,
    removeSelected,
  } = useProject();
  const chosen = project.blocks.filter((b) => selectedIds.includes(b.id)),
    groupId = chosen[0]?.groupId;
  const grouped =
    groupId &&
    chosen.every((b) => b.groupId === groupId) &&
    chosen.length ===
      project.blocks.filter((b) => b.groupId === groupId).length;
  return (
    <div className="selection-tools" aria-label="Действия с выделением">
      <button
        aria-pressed={multiSelect}
        onClick={() => setMultiSelect(!multiSelect)}
      >
        Множественный выбор
      </button>
      <span>
        {chosen.length
          ? `Выбрано: ${chosen.length}`
          : "Shift + нажатие — добавить в выделение"}
      </span>
      {chosen.length > 0 && (
        <>
          {chosen.length > 1 &&
            (grouped ? (
              <button onClick={() => ungroup(groupId!)}>Разгруппировать</button>
            ) : (
              <button
                disabled={chosen.some((b) => b.locked)}
                onClick={groupSelection}
              >
                Сгруппировать
              </button>
            ))}
          <button
            onClick={() =>
              patchSelection({ locked: !chosen.every((b) => b.locked) })
            }
          >
            {chosen.every((b) => b.locked)
              ? "Разблокировать выделение"
              : "Закрепить выделение"}
          </button>
          <button onClick={duplicateSelected}>Дублировать выделение</button>
          {chosen.length > 1 && (
            <button onClick={removeSelected}>Удалить выделение</button>
          )}
        </>
      )}
    </div>
  );
}
