import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import type { Block } from "../model/types";
import { gestureBlock, type ResizeEdge } from "../model/gestures";
import { CANVAS_PADDING } from "../model/canvasLayout";
export type InteractionMode =
  "idle" | "selected" | "dragging" | "resizing" | "panning" | "editing-content";
interface Options {
  board: RefObject<HTMLDivElement | null>;
  width: number;
  columns: number;
  gap: number;
  rowHeight: number;
  onSelect?: (id: string | null) => void;
  onUpdate?: (id: string, patch: Partial<Block>) => void;
  enabled: boolean;
  reset: unknown;
}
export function useCanvasGesture(options: Options) {
  const [gesture, setGesture] = useState<{
      block: Block;
      edge?: ResizeEdge;
    } | null>(null),
    [mode, setMode] = useState<InteractionMode>("idle");
  const cleanup = useRef<(() => void) | null>(null),
    suppressClick = useRef(false);
  useEffect(() => {
    cleanup.current?.();
    setGesture(null);
    setMode("idle");
    return () => cleanup.current?.();
  }, [options.reset]);
  const begin = (
    event: ReactPointerEvent,
    block: Block,
    edge?: ResizeEdge,
    immediate = false,
  ) => {
    if (!options.enabled || event.button !== 0 || !options.board.current)
      return;
    if (event.isPrimary === false) {
      cleanup.current?.();
      setGesture(null);
      setMode("selected");
      return;
    }
    options.onSelect?.(block.id);
    setMode("selected");
    if (block.locked) return;
    const target = event.target as Element;
    if (
      !edge &&
      !immediate &&
      target.closest(
        'button,a,input,textarea,select,video,iframe,audio,[contenteditable="true"]',
      )
    )
      return;
    event.stopPropagation();
    if (edge || immediate) event.preventDefault();
    cleanup.current?.();
    const pointer = event.pointerId,
      element = event.currentTarget as HTMLElement,
      startX = event.clientX,
      startY = event.clientY;
    const scale =
      options.board.current.getBoundingClientRect().width /
      (options.width - CANVAS_PADDING * 2);
    const unitX =
        (options.width - CANVAS_PADDING * 2 + options.gap) / options.columns,
      unitY = options.rowHeight + options.gap;
    let candidate = block,
      active = false,
      moved = false,
      panning = false;
    const activate = () => {
      if (panning) return;
      active = true;
      setMode(edge ? "resizing" : "dragging");
      setGesture({ block, edge });
      try {
        element.setPointerCapture(pointer);
      } catch {}
      if (event.pointerType === "touch") navigator.vibrate?.(15);
    };
    const timer =
      event.pointerType === "touch" && !edge && !immediate
        ? window.setTimeout(activate, 350)
        : undefined;
    if (edge || immediate) activate();
    const previous = document.body.style.userSelect;
    const move = (next: PointerEvent) => {
      if (next.pointerId !== pointer) return;
      const dx = next.clientX - startX,
        dy = next.clientY - startY,
        distance = Math.hypot(dx, dy);
      if (!active) {
        if (event.pointerType === "touch") {
          if (distance > 8) {
            panning = true;
            clearTimeout(timer);
            setMode("panning");
          }
          return;
        }
        if (distance < 4) return;
        activate();
      }
      if (panning) return;
      moved ||= distance > 2;
      document.body.style.userSelect = "none";
      candidate = gestureBlock(
        block,
        dx / scale,
        dy / scale,
        options.columns,
        unitX,
        unitY,
        edge,
      );
      setGesture({ block: candidate, edge });
    };
    const finish = (next: PointerEvent) => {
      if (next.pointerId !== pointer) return;
      cleanup.current?.();
      setGesture(null);
      setMode("selected");
      if (active && moved) {
        suppressClick.current = true;
        window.setTimeout(() => (suppressClick.current = false), 0);
        options.onUpdate?.(block.id, candidate);
      }
    };
    const cancel = () => {
      cleanup.current?.();
      setGesture(null);
      setMode("selected");
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    const touch = (e: TouchEvent) => {
      if (active && !panning) e.preventDefault();
    };
    const second = (e: PointerEvent) => {
      if (e.pointerId !== pointer) cancel();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key);
    window.addEventListener("blur", cancel);
    window.addEventListener("pointerdown", second);
    window.addEventListener("touchmove", touch, { passive: false });
    cleanup.current = () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("pointerdown", second);
      window.removeEventListener("touchmove", touch);
      document.body.style.userSelect = previous;
      cleanup.current = null;
      try {
        if (element.hasPointerCapture(pointer))
          element.releasePointerCapture(pointer);
      } catch {}
    };
  };
  return { gesture, mode, begin, suppressClick };
}
