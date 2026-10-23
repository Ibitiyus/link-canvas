export const CATEGORIES = [
  "Art & Design",
  "Music",
  "Personal",
  "Gaming",
  "Photography",
  "Cybercore",
  "Punk / Grunge",
  "Old Web",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];
export type ExploreSort = "new" | "updated" | "random";
export interface GalleryCard {
  username: string;
  title: string;
  description: string;
  category: Category;
  cover: string;
  listed_at: string;
  updated_at: string;
}
export interface GalleryResult {
  items: GalleryCard[];
  has_more: boolean;
  next_offset: number;
}
export interface Presentation {
  title: string;
  description: string;
  category: Category;
  cover: string;
}
export const COVER_LIMIT = 65536;
export function isCover(value: unknown): value is string {
  if (value === "") return true;
  if (
    typeof value !== "string" ||
    value.length > 87408 ||
    !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  )
    return false;
  try {
    const bytes = atob(value.slice(23));
    return (
      bytes.length <= COVER_LIMIT &&
      bytes.startsWith("\xff\xd8\xff") &&
      bytes.endsWith("\xff\xd9")
    );
  } catch {
    return false;
  }
}
export function presentationError(value: Presentation) {
  if (!value.title.trim() || [...value.title.trim()].length > 80)
    return "Название должно содержать от 1 до 80 символов.";
  if ([...value.description].length > 280)
    return "Описание должно быть не длиннее 280 символов.";
  if (!CATEGORIES.includes(value.category))
    return "Выберите категорию из списка.";
  if (!isCover(value.cover))
    return "Обложка повреждена или слишком велика. Загрузите изображение заново.";
  return "";
}
/** Treat network data as untrusted; media URLs/HTML/projects are never forwarded to cards. */
export function parseGallery(value: unknown): GalleryResult {
  if (!value || typeof value !== "object")
    throw new Error("Некорректный ответ галереи.");
  const result = value as Record<string, unknown>;
  if (
    !Array.isArray(result.items) ||
    result.items.length > 24 ||
    typeof result.has_more !== "boolean" ||
    !Number.isInteger(result.next_offset) ||
    Number(result.next_offset) < 0 ||
    Number(result.next_offset) > 10024
  )
    throw new Error("Некорректный ответ галереи.");
  const items = result.items.map((raw: unknown): GalleryCard => {
    const card = raw as GalleryCard;
    if (
      !card ||
      typeof card.username !== "string" ||
      !/^[a-z0-9][a-z0-9_-]{2,29}$/.test(card.username) ||
      typeof card.title !== "string" ||
      typeof card.description !== "string" ||
      presentationError(card) ||
      !Number.isFinite(Date.parse(card.listed_at)) ||
      !Number.isFinite(Date.parse(card.updated_at))
    )
      throw new Error("Некорректная карточка галереи.");
    return {
      username: card.username,
      title: card.title,
      description: card.description,
      category: card.category,
      cover: card.cover,
      listed_at: card.listed_at,
      updated_at: card.updated_at,
    };
  });
  return {
    items,
    has_more: result.has_more && Number(result.next_offset) <= 10000,
    next_offset: Number(result.next_offset),
  };
}
