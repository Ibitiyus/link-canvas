import { imageMime } from "../model/assets";
import { emptyProject, newBlock } from "../model/defaults";
import { DEFAULT_ANIMATION, DEFAULT_VISUAL } from "../model/effects";
import { parseProject } from "../model/storage";
import { createId } from "../model/id";
import { mapProjectSources } from "../cloud/projectAssets";
import { storeFiles } from "../model/fileStore";
import type { Block, BlockType, Project } from "../model/types";
import type { BuiltinId } from "./catalog";
const path = "/templates/v1/";
export function buildTemplate(id: BuiltinId, origin: string): Project {
  const p = emptyProject();
  p.page.maxWidth = 960;
  p.page.title = id;
  p.page.gap = 16;
  const url = (name: string) => new URL(path + name, origin).href;
  const add = (type: BlockType, name: string, patch: Partial<Block>) => {
    const b = {
      ...newBlock(type),
      id: `${id}-${p.blocks.length}`,
      name,
      radius: 0,
      layer: p.blocks.length,
      ...patch,
    };
    p.blocks.push(b);
    return b;
  };
  const text = (content: string, patch: Partial<Block> = {}) =>
    add("text", content.split("\n")[0], {
      content,
      background: "#00000000",
      color: "#ffffff",
      colSpan: 4,
      rowSpan: 2,
      fontSize: 48,
      ...patch,
    });
  const free = (
    type: BlockType,
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    patch: Partial<Block> = {},
  ) => add(type, name, { layout: "free", x, y, width, height, ...patch });
  const link = (
    content: string,
    row: number,
    col = 0,
    colSpan = 2,
    patch: Partial<Block> = {},
  ) =>
    add("link", content, {
      content,
      url: "https://example.com",
      row,
      col,
      colSpan,
      rowSpan: 1,
      background: "#ff3970",
      color: "#0d0d0f",
      ...patch,
    });
  const fx = (type: "float" | "spin" | "sway" | "pulse") => ({
    animation: { ...DEFAULT_ANIMATION, type, intensity: 0.35 },
    hover: "glow" as const,
  });
  if (id === "blank-canvas") {
    p.page.title = "Чистое полотно";
    return p;
  }
  if (id === "cybercore") {
    p.page.title = "CYBER / 01";
    p.page.background = "#0b0910";
    text("CYBER\nHUMAN.exe", {
      fontSize: 72,
      colSpan: 3,
      rowSpan: 3,
      background: "#ff3970",
      color: "#07060b",
    });
    add("image", "Хромированная сфера", {
      url: url("chrome.webp"),
      col: 3,
      row: 0,
      rowSpan: 3,
      background: "#00000000",
      effects: { hover: "scale", visual: { ...DEFAULT_VISUAL, glow: 8 } },
    });
    text(
      "Личный сигнал из цифрового будущего.\nЗамените имя, фото и ссылки — это ваше пространство.",
      { row: 3, rowSpan: 1, fontSize: 21 },
    );
    link("МОИ ПРОЕКТЫ ↗", 4);
    link("НАПИСАТЬ ↗", 4, 2, 2, { background: "#d7d8e5" });
    add("qrcode", "Сканируй мой сигнал", {
      url: "https://example.com",
      row: 5,
      col: 3,
      colSpan: 1,
      rowSpan: 2,
    });
    free("decoration", "Орбитальная звезда", 655, 240, 110, 110, {
      content: "✧",
      color: "#bbff31",
      fontSize: 100,
      effects: fx("spin"),
      rotation: 15,
    });
    free("text", "Версия автора", 40, 670, 540, 80, {
      content: "100% HUMAN • EST. 2026",
      fontSize: 26,
      color: "#ff3970",
      background: "#00000000",
      rotation: -3,
    });
  }
  if (id === "punk-zine") {
    p.page.title = "НЕ ПО ФОРМАТУ";
    p.page.background = "#c8c1ac";
    text("НЕ ПО\nФОРМАТУ", {
      color: "#111111",
      fontSize: 88,
      colSpan: 4,
      rowSpan: 3,
    });
    add("image", "Бумага и шум", {
      url: url("paper.webp"),
      row: 3,
      colSpan: 4,
      rowSpan: 3,
    });
    const a = free("image", "Световой коллаж", 65, 410, 430, 300, {
      url: url("light.webp"),
      rotation: -9,
      borderWidth: 8,
      borderColor: "#f2eddb",
    });
    const b = free("text", "Манифест", 475, 430, 340, 210, {
      content: "ДЕЛАЙ ГРОМКО.\nБУДЬ СОБОЙ.",
      fontSize: 40,
      background: "#111111",
      color: "#f4f0df",
      rotation: 7,
    });
    p.groups = [
      { id: "punk-collage", name: "Бумажный коллаж", effects: fx("sway") },
    ];
    a.groupId = b.groupId = "punk-collage";
    free("decoration", "Розовая печать", 695, 300, 130, 130, {
      content: "✸",
      color: "#ff3970",
      fontSize: 120,
      effects: fx("pulse"),
    });
    link("ЧИТАТЬ МОЙ ЗИН", 6, 0, 3, {
      background: "#111111",
      color: "#f8f0dd",
    });
    link("КОНТАКТ", 6, 3, 1, { background: "#ff3970" });
  }
  if (id === "old-web") {
    p.page.title = "МОЯ ДОМАШНЯЯ СТРАНИЧКА";
    p.page.columns = 3;
    p.page.background = "#16114c";
    p.page.font = "mono";
    text("★ ДОБРО ПОЖАЛОВАТЬ ★", {
      colSpan: 3,
      rowSpan: 1,
      fontSize: 36,
      background: "#111111",
      color: "#bbff31",
      align: "center",
    });
    add("gif", "Сайт живёт!", {
      url: url("star.gif"),
      row: 1,
      colSpan: 1,
      rowSpan: 2,
      fit: "contain",
    });
    text(
      "ПРИВЕТ, ИНТЕРНЕТ!\nЗдесь мои находки, музыка и любимые места.\n\nОбновлено вручную ♥",
      {
        row: 1,
        col: 1,
        colSpan: 2,
        rowSpan: 2,
        fontSize: 23,
        background: "#f2efda",
        color: "#16114c",
      },
    );
    link("ГОСТЕВАЯ КНИГА", 3, 0, 1, { background: "#bbff31" });
    link("ИЗБРАННЫЕ ССЫЛКИ", 3, 1, 2, { background: "#ffb6da" });
    add("audio", "Звук моего уголка", {
      content: "Синтезированное демо ZIN",
      url: url("demo.wav"),
      row: 4,
      colSpan: 2,
      rowSpan: 2,
      background: "#090a20",
      color: "#bbff31",
    });
    add("qrcode", "Передай другу", {
      row: 4,
      col: 2,
      colSpan: 1,
      rowSpan: 2,
      url: "https://example.com",
    });
    text("ВЫ ПОСЕТИТЕЛЬ № 000001 • НЕ СЧЁТЧИК, А НОСТАЛЬГИЯ", {
      row: 6,
      colSpan: 3,
      rowSpan: 1,
      fontSize: 16,
      color: "#ffb6da",
      align: "center",
    });
  }
  if (id === "minimal-brutalism") {
    p.page.title = "ИМЯ / ПРАКТИКА";
    p.page.columns = 5;
    p.page.background = "#f0efea";
    p.page.gap = 8;
    text("ИМЯ.\nПРАКТИКА.", {
      colSpan: 5,
      rowSpan: 3,
      fontSize: 100,
      color: "#111111",
    });
    text("ДИЗАЙНЕР / АВТОР\nРаботаю с идеями, формой и смыслом.", {
      row: 3,
      colSpan: 3,
      rowSpan: 2,
      fontSize: 31,
      color: "#111111",
      bold: false,
    });
    text("01\nМОСКВА\n2026", {
      row: 3,
      col: 3,
      colSpan: 2,
      rowSpan: 2,
      fontSize: 26,
      color: "#111111",
      align: "right",
    });
    link("ПРОЕКТЫ ↗", 5, 0, 3, { background: "#111111", color: "#ffffff" });
    link("КОНТАКТ ↗", 5, 3, 2, {
      background: "#f0efea",
      borderWidth: 2,
      borderColor: "#111111",
    });
    free("decoration", "Линия", 0, 355, 910, 24, {
      content: " ",
      imageUrl: "",
      background: "#111111",
      fontSize: 8,
      opacity: 0.8,
    });
  }
  if (id === "music-artist") {
    p.page.title = "NO SIGNAL / NEW SOUND";
    p.page.background = "#131020";
    add("image", "Обложка релиза", {
      url: url("release.webp"),
      colSpan: 2,
      rowSpan: 3,
    });
    text("NO SIGNAL\nNEW SOUND", {
      col: 2,
      colSpan: 2,
      rowSpan: 2,
      fontSize: 49,
      color: "#c8bcff",
    });
    text("Электроника из моей комнаты.\nНовый релиз — ваше название.", {
      row: 2,
      col: 2,
      colSpan: 2,
      rowSpan: 1,
      fontSize: 21,
    });
    add("audio", "Первый сингл", {
      content: "ZIN — оригинальное синтезированное демо",
      url: url("demo.wav"),
      imageUrl: url("release.webp"),
      row: 3,
      colSpan: 4,
      rowSpan: 2,
      background: "#29223f",
      color: "#c8bcff",
      effects: { hover: "glow" },
    });
    add("video", "Визуализатор", {
      url: url("visual.webm"),
      row: 5,
      colSpan: 3,
      rowSpan: 2,
    });
    link("СЛУШАТЬ РЕЛИЗ", 5, 3, 1, { background: "#c8bcff" });
    link("БУКИНГ ↗", 6, 3, 1, { background: "#ff3970" });
    free("decoration", "Нота", 760, 235, 100, 100, {
      content: "♫",
      color: "#ff3970",
      fontSize: 90,
      rotation: 12,
      effects: fx("float"),
    });
  }
  if (id === "photographer") {
    p.page.title = "СВЕТ / ФОРМА";
    p.page.columns = 3;
    p.page.background = "#e9e5dd";
    p.page.gap = 12;
    text("СВЕТ / ФОРМА", {
      colSpan: 3,
      rowSpan: 1,
      fontSize: 48,
      color: "#272c30",
    });
    add("image", "Этюд 01 — тёплый свет", {
      url: url("light.webp"),
      row: 1,
      colSpan: 2,
      rowSpan: 3,
    });
    add("image", "Этюд 02 — архитектура", {
      url: url("architecture.webp"),
      row: 1,
      col: 2,
      rowSpan: 3,
    });
    text(
      "01 / ТИШИНА И ФОРМА\nАвторские иллюстративные этюды. Замените своими фотографиями.",
      {
        row: 4,
        colSpan: 3,
        rowSpan: 1,
        fontSize: 21,
        color: "#272c30",
        bold: false,
      },
    );
    add("image", "Этюд 03 — отражения", {
      url: url("chrome.webp"),
      row: 5,
      colSpan: 1,
      rowSpan: 2,
      effects: { hover: "scale" },
    });
    add("image", "Этюд 04 — ритм", {
      url: url("architecture.webp"),
      row: 5,
      col: 1,
      colSpan: 2,
      rowSpan: 2,
      effects: { hover: "scale" },
    });
    link("ОБСУДИТЬ СЪЁМКУ ↗", 7, 0, 3, {
      background: "#272c30",
      color: "#f0efea",
    });
    free("text", "Авторская отметка", 555, 440, 280, 70, {
      content: "ПОРТФОЛИО / 2026",
      fontSize: 20,
      color: "#272c30",
      background: "#e9e5ddcc",
      rotation: -5,
    });
  }
  if (id === "gaming-profile") {
    p.page.title = "PLAYER ONE";
    p.page.columns = 5;
    p.page.background = "#0c1619";
    p.page.gap = 10;
    text("PLAYER ONE", {
      colSpan: 4,
      rowSpan: 2,
      fontSize: 68,
      color: "#bbff31",
    });
    add("gif", "Онлайн-индикатор", {
      url: url("star.gif"),
      col: 4,
      rowSpan: 2,
      fit: "contain",
      background: "#15232a",
    });
    text("СТРИМЫ / КЛИПЫ / МОЙ ОТРЯД", {
      row: 2,
      colSpan: 5,
      rowSpan: 1,
      fontSize: 25,
      background: "#bbff31",
      color: "#0c1619",
    });
    add("video", "Экран эфира", {
      url: url("visual.webm"),
      row: 3,
      colSpan: 3,
      rowSpan: 3,
      borderWidth: 2,
      borderColor: "#bbff31",
    });
    text("LVL 99\nCO-OP: ON\nРЕЖИМ: ТВОРИТЬ", {
      row: 3,
      col: 3,
      colSpan: 2,
      rowSpan: 2,
      fontSize: 29,
      background: "#15232a",
      color: "#bbff31",
    });
    link("МОЙ КАНАЛ ↗", 5, 3, 2, { background: "#ff3970" });
    link("ПРИСОЕДИНИТЬСЯ", 6, 0, 3, { background: "#bbff31" });
    add("qrcode", "Код отряда", {
      row: 6,
      col: 3,
      colSpan: 2,
      rowSpan: 2,
      url: "https://example.com",
    });
    free("decoration", "HUD прицел", 730, 185, 100, 100, {
      content: "⊕",
      color: "#ff3970",
      fontSize: 90,
      opacity: 0.7,
      effects: fx("pulse"),
    });
  }
  return parseProject(JSON.stringify(p));
}
export function freshProject(project: Project): Project {
  const p = structuredClone(project),
    groups = new Map((p.groups ?? []).map((g) => [g.id, createId()]));
  p.groups = p.groups?.map((g) => ({ ...g, id: groups.get(g.id)! }));
  const fonts = new Map((p.customFonts ?? []).map((f) => [f.id, createId()]));
  p.customFonts = p.customFonts?.map((f) => ({ ...f, id: fonts.get(f.id)! }));
  if (!project.customFonts) delete p.customFonts;
  p.blocks = p.blocks.map((b) => ({
    ...b,
    id: createId(),
    ...(b.fontFamily?.startsWith("font:")
      ? { fontFamily: `font:${fonts.get(b.fontFamily.slice(5))!}` }
      : {}),
    ...(b.groupId ? { groupId: groups.get(b.groupId)! } : {}),
  }));
  if (!project.groups) delete p.groups;
  return p;
}
/** Copy only a chosen starter's bundled files; never depend on another host at publication. */
export async function materializeBuiltin(project: Project): Promise<Project> {
  const replacements = new Map<string, string>(),
    files: { id: string; name: string; blob: Blob }[] = [];
  const values = [
    project.page.backgroundImage,
    ...project.blocks.flatMap((b) => [b.url, b.imageUrl]),
  ];
  for (const value of new Set(values)) {
    let u: URL;
    try {
      u = new URL(value);
    } catch {
      continue;
    }
    if (u.origin !== location.origin || !u.pathname.startsWith(path)) continue;
    const response = await fetch(u.href);
    if (!response.ok)
      throw new Error("Не удалось загрузить медиа шаблона. Повторите попытку.");
    const bytesBlob = await response.blob(),
      bytes = new Uint8Array(await bytesBlob.slice(0, 64).arrayBuffer()),
      name = u.pathname.split("/").pop()!;
    const mime =
      imageMime(bytes) ??
      (name.endsWith(".wav") &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WAVE"
        ? "audio/wav"
        : name.endsWith(".webm") &&
            bytes[0] === 0x1a &&
            bytes[1] === 0x45 &&
            bytes[2] === 0xdf &&
            bytes[3] === 0xa3
          ? "video/webm"
          : null);
    if (!mime)
      throw new Error(
        "Не удалось загрузить медиа шаблона: сервер вернул неподдерживаемый файл.",
      );
    const id = createId();
    files.push({ id, name, blob: new Blob([bytesBlob], { type: mime }) });
    replacements.set(value, `asset:${id}`);
  }
  await storeFiles(files);
  return freshProject(
    mapProjectSources(project, (v) => replacements.get(v) ?? v),
  );
}
