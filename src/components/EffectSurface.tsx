import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  animationDuration,
  DEFAULT_VISUAL,
  type Effects,
} from "../model/effects";
interface Props {
  effects?: Effects;
  active: boolean;
  suspended?: boolean;
  previewToken?: number;
  children: ReactNode;
}
export function EffectSurface({
  effects,
  active,
  suspended = false,
  previewToken = 0,
  children,
}: Props) {
  const ref = useRef<HTMLDivElement>(null),
    [visible, setVisible] = useState(true),
    [tab, setTab] = useState(!document.hidden),
    [temporary, setTemporary] = useState(false);
  const a = effects?.animation,
    v = effects?.visual ?? DEFAULT_VISUAL;
  useEffect(() => {
    if (!previewToken) {
      setTemporary(false);
      return;
    }
    setTemporary(true);
    // Replay the CSS timeline without remounting video/audio/iframe children.
    const frame = requestAnimationFrame(() => {
      const motion = ref.current?.querySelector<HTMLElement>(
        ":scope > .effect-animation",
      );
      if (!motion) return;
      motion.style.animationName = "none";
      void motion.offsetWidth;
      motion.style.animationName = "";
    });
    const timer = setTimeout(
      () => setTemporary(false),
      Math.min(
        60000,
        ((a ? animationDuration(a) : 3) + (a?.delay ?? 0)) * 1000,
      ),
    );
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [previewToken]);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "80px" },
    );
    observer.observe(node);
    const update = () => setTab(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const animate =
    !!a?.enabled && a.type !== "none" && (active || temporary) && !suspended;
  const style = {
    "--effect-duration": `${a ? animationDuration(a) : 3}s`,
    "--effect-delay": `${a?.delay ?? 0}s`,
    "--effect-repeat": a?.repeat === "once" ? "1" : "infinite",
    "--effect-direction": a?.direction ?? "normal",
    "--effect-distance": `${(a?.intensity ?? 0) * 24}px`,
    "--effect-angle": `${(a?.intensity ?? 0) * 16}deg`,
    "--effect-scale": 1 + (a?.intensity ?? 0) * 0.16,
    "--effect-start-scale": 1 - (a?.intensity ?? 0) * 0.35,
    "--effect-alpha": 1 - (a?.intensity ?? 0) * 0.18,
    animationPlayState: visible && tab ? "running" : "paused",
  } as CSSProperties;
  const filter = `blur(${v.blur}px) brightness(${v.brightness}) contrast(${v.contrast}) saturate(${v.saturation}) hue-rotate(${v.hue}deg) grayscale(${v.grayscale})${v.glow ? ` drop-shadow(0 0 ${v.glow}px #ff3970)` : ""}${v.shadow ? ` drop-shadow(0 ${v.shadow / 3}px ${v.shadow}px #0009)` : ""}`;
  return (
    <div
      ref={ref}
      className="effect-root"
      data-effect-active={animate}
      data-effect-visible={visible && tab}
    >
      <div
        className={`effect-animation ${animate ? `anim-${a!.type}` : ""}`}
        style={style}
      >
        <div
          className={`effect-hover hover-${effects?.hover ?? "none"}`}
          data-hover-enabled={!suspended && (active || temporary)}
        >
          <div
            className="effect-visual"
            style={effects?.visual ? { filter } : undefined}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
