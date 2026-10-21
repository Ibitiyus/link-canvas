export const CATEGORIES = [
  "Все",
  "Цифровая эстетика",
  "Коллаж",
  "Минимализм",
  "Музыка",
  "Портфолио",
  "Игры",
  "Пустой",
] as const;
export const TEMPLATE_CATALOG = [
  {
    id: "cybercore",
    name: "Cybercore",
    category: "Цифровая эстетика",
    description:
      "Хромированная сфера, розовый неон, свободные слои и парящие орбиты.",
  },
  {
    id: "punk-zine",
    name: "Punk Zine",
    category: "Коллаж",
    description:
      "Рваная бумага, повёрнутые подписи, зерно и стикеры в общей группе.",
  },
  {
    id: "old-web",
    name: "Old Web",
    category: "Цифровая эстетика",
    description:
      "Личный уголок нулевых: три колонки, GIF, гостевая и маленький плеер.",
  },
  {
    id: "minimal-brutalism",
    name: "Minimal Brutalism",
    category: "Минимализм",
    description:
      "Пять колонок, крупная типографика, строгие линии и минимум цвета.",
  },
  {
    id: "music-artist",
    name: "Music Artist",
    category: "Музыка",
    description:
      "Обложка релиза, рабочий аудиоплеер, видео и ссылки для музыканта.",
  },
  {
    id: "photographer",
    name: "Photographer",
    category: "Портфолио",
    description:
      "Серия авторских световых этюдов, крупные изображения и редакционные подписи.",
  },
  {
    id: "gaming-profile",
    name: "Gaming Profile",
    category: "Игры",
    description:
      "Игровой HUD, пять колонок, анимированный статус и видеовизуализатор.",
  },
  {
    id: "blank-canvas",
    name: "Blank Canvas",
    category: "Пустой",
    description:
      "Никаких блоков и декора. Только чистое полотно для вашей идеи.",
  },
] as const;
export type BuiltinId = (typeof TEMPLATE_CATALOG)[number]["id"];
