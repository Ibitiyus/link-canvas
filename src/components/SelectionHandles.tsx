import type { PointerEvent } from "react";
import type { Block } from "../model/types";
import { RESIZE_EDGES, type ResizeEdge } from "../model/gestures";
export function SelectionHandles({
  block,
  onResize,
}: {
  block: Block;
  onResize: (event: PointerEvent, edge: ResizeEdge) => void;
}) {
  const labels = {
    n: "верхний край",
    ne: "верхний правый угол",
    e: "правый край",
    se: "нижний правый угол",
    s: "нижний край",
    sw: "нижний левый угол",
    w: "левый край",
    nw: "верхний левый угол",
  };
  return (
    <>
      {RESIZE_EDGES.map((edge) => (
        <button
          key={edge}
          type="button"
          className={`resize-handle resize-${edge}`}
          data-resize-edge={edge}
          aria-label={
            edge === "se"
              ? `Изменить размер: ${block.name}`
              : `Изменить размер: ${block.name} — ${labels[edge]}`
          }
          title={labels[edge]}
          onPointerDown={(event) => onResize(event, edge)}
        />
      ))}
      <span className="size-badge">
        {block.type === "decoration"
          ? `${Math.round(block.width)} × ${Math.round(block.height)}`
          : `${block.colSpan} × ${block.rowSpan}`}
      </span>
    </>
  );
}
