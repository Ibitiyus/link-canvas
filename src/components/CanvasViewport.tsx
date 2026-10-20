import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { canvasExtent, fitCanvas } from "../model/canvasLayout";
import type { Block } from "../model/types";
interface Props {
  width: number;
  minHeight: number;
  decorations: Block[];
  children: ReactNode;
}
/** One transform for the entire composition. Zoom never writes to the project. */
export function CanvasViewport({
  width,
  minHeight,
  decorations,
  children,
}: Props) {
  const viewport = useRef<HTMLDivElement>(null),
    logical = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ available: 0, height: 0 });
  const [zoom, setZoom] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!viewport.current || !logical.current) return;
    const update = () => {
      if (!viewport.current || !logical.current) return;
      const next = {
        available: viewport.current!.clientWidth,
        height: logical.current!.offsetHeight,
      };
      setSize((previous) =>
        previous.available === next.available && previous.height === next.height
          ? previous
          : next,
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(viewport.current);
    observer.observe(logical.current);
    update();
    return () => observer.disconnect();
  }, []);
  const extent = canvasExtent(
    width,
    Math.max(minHeight, size.height),
    decorations,
  );
  const fit = fitCanvas(size.available || width, extent.width),
    scale = zoom ?? fit;
  return (
    <div className="canvas-renderer" ref={viewport} data-canvas-scale={scale}>
      <div
        className="canvas-view-controls"
        role="group"
        aria-label="Масштаб полотна"
      >
        <button
          type="button"
          aria-label="Уменьшить полотно"
          disabled={scale <= 0.01}
          onClick={() => setZoom(Math.max(0.01, scale / 1.25))}
        >
          <Minus size={15} />
        </button>
        <output aria-label="Текущий масштаб">{Math.round(scale * 100)}%</output>
        <button
          type="button"
          aria-label="Увеличить полотно"
          disabled={scale >= 4}
          onClick={() => setZoom(Math.min(4, scale * 1.25))}
        >
          <Plus size={15} />
        </button>
        <button
          type="button"
          aria-pressed={zoom === null}
          onClick={() => setZoom(null)}
        >
          По ширине
        </button>
      </div>
      <div
        className="canvas-frame"
        tabIndex={0}
        aria-label="Область просмотра полотна"
      >
        <div
          className="canvas-extent"
          style={{ width: extent.width * scale, height: extent.height * scale }}
        >
          <div
            className="canvas-transform"
            style={{
              width: extent.width,
              transform: `scale(${scale})`,
              paddingLeft: extent.left,
              paddingTop: extent.top,
            }}
          >
            <div className="canvas-logical" ref={logical} style={{ width }}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
