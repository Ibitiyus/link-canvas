export const ANIMATIONS = {
  none: "Нет анимации",
  spin: "Вращение",
  sway: "Покачивание",
  float: "Парение",
  pulse: "Пульсация",
  flicker: "Мерцание",
  glitch: "Glitch",
  fade: "Плавное появление",
  slide: "Скольжение при появлении",
  zoom: "Увеличение при появлении",
} as const;
export const HOVERS = {
  none: "Нет",
  scale: "Увеличение",
  tilt: "Наклон",
  glow: "Свечение",
  opacity: "Прозрачность",
  bounce: "Подпрыгивание",
} as const;
export interface AnimationSettings {
  enabled: boolean;
  type: keyof typeof ANIMATIONS;
  duration: number;
  intensity: number;
  delay: number;
  repeat: "once" | "infinite";
  direction: "normal" | "reverse" | "alternate";
}
export interface VisualSettings {
  glow: number;
  shadow: number;
  blur: number;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  grayscale: number;
}
export interface Effects {
  animation?: AnimationSettings;
  hover?: keyof typeof HOVERS;
  visual?: VisualSettings;
}
export const DEFAULT_ANIMATION: AnimationSettings = {
  enabled: true,
  type: "none",
  duration: 3,
  intensity: 0.5,
  delay: 0,
  repeat: "infinite",
  direction: "normal",
};
export const DEFAULT_VISUAL: VisualSettings = {
  glow: 0,
  shadow: 0,
  blur: 0,
  brightness: 1,
  contrast: 1,
  saturation: 1,
  hue: 0,
  grayscale: 0,
};
export const VISUAL_LIMITS = {
  glow: [0, 24],
  shadow: [0, 24],
  blur: [0, 12],
  brightness: [0.25, 2],
  contrast: [0.25, 2],
  saturation: [0, 3],
  hue: [-180, 180],
  grayscale: [0, 1],
} as const;
export function parseEffects(value: unknown): Effects {
  const fail = () => {
    throw new Error("Некорректные настройки анимации или эффектов.");
  };
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail();
  const e = value as Record<string, unknown>,
    result: Effects = {};
  const num = (v: unknown, min: number, max: number): number =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max
      ? v
      : fail();
  if (e.animation !== undefined) {
    if (
      !e.animation ||
      typeof e.animation !== "object" ||
      Array.isArray(e.animation)
    )
      return fail();
    const a = e.animation as Record<string, unknown>;
    if (
      typeof a.enabled !== "boolean" ||
      typeof a.type !== "string" ||
      typeof a.repeat !== "string" ||
      typeof a.direction !== "string" ||
      !Object.hasOwn(ANIMATIONS, String(a.type)) ||
      !["once", "infinite"].includes(String(a.repeat)) ||
      !["normal", "reverse", "alternate"].includes(String(a.direction))
    )
      return fail();
    result.animation = {
      enabled: a.enabled,
      type: a.type as AnimationSettings["type"],
      duration: num(a.duration, 0.8, 30),
      intensity: num(a.intensity, 0, 1),
      delay: num(a.delay, 0, 30),
      repeat: a.repeat as AnimationSettings["repeat"],
      direction: a.direction as AnimationSettings["direction"],
    };
  }
  if (e.hover !== undefined) {
    if (typeof e.hover !== "string" || !Object.hasOwn(HOVERS, String(e.hover)))
      return fail();
    result.hover = e.hover as Effects["hover"];
  }
  if (e.visual !== undefined) {
    if (!e.visual || typeof e.visual !== "object" || Array.isArray(e.visual))
      return fail();
    const v = e.visual as Record<string, unknown>;
    result.visual = Object.fromEntries(
      Object.entries(VISUAL_LIMITS).map(([k, [min, max]]) => [
        k,
        num(v[k], min, max),
      ]),
    ) as unknown as VisualSettings;
  }
  return result;
}
/** Flicker/glitch are deliberately slow, with bounded contrast/opacity. */
export function animationDuration(a: AnimationSettings) {
  return Math.max(
    a.type === "flicker" || a.type === "glitch" ? 2 : 0.8,
    a.duration,
  );
}
