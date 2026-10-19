import { isCloudRef } from "../cloud/projectAssets";
import { safeUrl } from "./media";
import { dataUrlMime, MAX_CUSTOM_FONTS, parseImageSource } from "./assets";
import { isAssetRef } from "./fileStore";
import { validFontChoice } from "./fonts";
import { clampDecoration, POSITION_LIMIT, SIZE_LIMIT } from "./decoration";
import { arrange } from "./grid";
import { emptyProject, newBlock } from "./defaults";
import {
  LABELS,
  type Block,
  type BlockType,
  type CustomFont,
  type Project,
} from "./types";

export const STORAGE_KEY = "link-canvas.project.v1";
const MAX_BLOCKS = 200;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Некорректный формат проекта.");
  return value as Record<string, unknown>;
}
function number(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}
function text(value: unknown, fallback: string, max = 10000): string {
  return typeof value === "string" ? value.slice(0, max) : fallback;
}
function color(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[\da-f]{6}([\da-f]{2})?$/i.test(value)
    ? value
    : fallback;
}
export function parseProject(raw: string): Project {
  let input: Record<string, unknown>;
  try {
    input = object(JSON.parse(raw));
  } catch {
    throw new Error("Не удалось прочитать JSON проекта.");
  }
  if (input.version !== 1)
    throw new Error("Версия проекта не поддерживается. Нужна версия 1.");
  const page = object(input.page);
  if (!Array.isArray(input.blocks) || input.blocks.length > MAX_BLOCKS)
    throw new Error("Проект должен содержать не более 200 блоков.");
  const defaults = emptyProject().page;
  const settings: Project["page"] = {
    title: text(page.title, defaults.title, 160),
    background: color(page.background, defaults.background),
    backgroundImage: parseImageSource(page.backgroundImage),
    columns: [3, 4, 5].includes(page.columns as number)
      ? (page.columns as 3 | 4 | 5)
      : 4,
    gap: number(page.gap, 16, 0, 48),
    maxWidth: number(page.maxWidth, 880, 320, 1400),
    font: page.font === "serif" || page.font === "mono" ? page.font : "system",
  };
  const fontInput = input.customFonts;
  if (
    fontInput !== undefined &&
    (!Array.isArray(fontInput) || fontInput.length > MAX_CUSTOM_FONTS)
  )
    throw new Error("В проекте может быть не больше 8 установленных шрифтов.");
  const fontIds = new Set<string>();
  const customFonts: CustomFont[] = (
    (fontInput as unknown[] | undefined) ?? []
  ).map((value) => {
    const font = object(value);
    const id = text(font.id, "", 100);
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || fontIds.has(id))
      throw new Error("Некорректный или повторяющийся идентификатор шрифта.");
    if (
      typeof font.dataUrl !== "string" ||
      (!isAssetRef(font.dataUrl) && !isCloudRef(font.dataUrl) && !safeUrl(font.dataUrl) && !dataUrlMime(font.dataUrl, "font"))
    )
      throw new Error("Некорректный файл шрифта в проекте.");
    fontIds.add(id);
    return {
      id,
      name: text(font.name, "Мой шрифт", 80),
      dataUrl: font.dataUrl,
    };
  });
  const ids = new Set<string>();
  const blocks = input.blocks.map((value) => {
    const source = object(value);
    if (!Object.hasOwn(LABELS, source.type as string))
      throw new Error("Неизвестный тип блока.");
    const defaults = newBlock(source.type as BlockType);
    const id = text(source.id, "", 100);
    if (!id || ids.has(id))
      throw new Error("Идентификаторы блоков должны быть уникальными.");
    ids.add(id);
    const block: Block = {
      ...defaults,
      id,
      name: text(source.name, defaults.name, 160),
      content: text(source.content, defaults.content),
      url:
        source.type === "image" || source.type === "gif"
          ? parseImageSource(source.url)
          : text(source.url, "", 2048),
      imageUrl: parseImageSource(source.imageUrl),
      fit: source.fit === "contain" ? "contain" : "cover",
      background: color(source.background, defaults.background),
      color: color(source.color, defaults.color),
      borderColor: color(source.borderColor, defaults.borderColor),
      bold: source.bold === true,
      align:
        source.align === "left" || source.align === "right"
          ? source.align
          : "center",
      radius: number(source.radius, 22, 0, 100),
      opacity: number(source.opacity, 1, 0, 1),
      borderWidth: number(source.borderWidth, 0, 0, 20),
      fontSize: number(source.fontSize, 18, 8, 144),
      col: Math.round(number(source.col, 0, 0, 4)),
      row: Math.round(number(source.row, 0, 0, 5000)),
      colSpan: Math.round(number(source.colSpan, 1, 1, 5)),
      rowSpan: Math.round(number(source.rowSpan, 1, 1, 12)),
      x: number(source.x, 24, -POSITION_LIMIT, POSITION_LIMIT),
      y: number(source.y, 24, -POSITION_LIMIT, POSITION_LIMIT),
      width: number(source.width, 100, 24, SIZE_LIMIT),
      height: number(source.height, 100, 24, SIZE_LIMIT),
      rotation: number(source.rotation, 0, -180, 180),
      zIndex: Math.round(number(source.zIndex, 1, 1, 1_000_000)),
    };
    if (source.fontFamily !== undefined) {
      if (!validFontChoice(source.fontFamily, customFonts))
        throw new Error("Неизвестный шрифт или отсутствует его файл.");
      block.fontFamily = source.fontFamily;
    }
    return clampDecoration(block, settings.maxWidth);
  });
  return {
    version: 1,
    ...(fontInput === undefined ? {} : { customFonts }),
    page: settings,
    blocks: arrange(blocks, settings.columns),
  };
}
export function readProject(storage: Pick<Storage, "getItem">): Project | null {
  const raw = storage.getItem(STORAGE_KEY);
  return raw === null ? null : parseProject(raw);
}
export function writeProject(
  storage: Pick<Storage, "setItem">,
  project: Project,
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(project));
}
