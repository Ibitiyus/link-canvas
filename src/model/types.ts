export type BlockType =
  | "link"
  | "text"
  | "image"
  | "gif"
  | "video"
  | "decoration";
export type Align = "left" | "center" | "right";
export interface Block {
  id: string;
  type: BlockType;
  name: string;
  content: string;
  url: string;
  imageUrl: string;
  fit: "cover" | "contain";
  background: string;
  color: string;
  radius: number;
  opacity: number;
  borderWidth: number;
  borderColor: string;
  fontSize: number;
  fontFamily?: string;
  align: Align;
  bold: boolean;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
}
export interface PageSettings {
  title: string;
  background: string;
  backgroundImage: string;
  columns: 3 | 4 | 5;
  gap: number;
  maxWidth: number;
  font: "system" | "serif" | "mono";
}
export interface CustomFont {
  id: string;
  name: string;
  dataUrl: string;
}
export interface Project {
  version: 1;
  customFonts?: CustomFont[];
  page: PageSettings;
  blocks: Block[];
}
export const ROW_HEIGHT = 112;
export const LABELS: Record<BlockType, string> = {
  link: "Ссылка",
  text: "Текст",
  image: "Изображение",
  gif: "GIF",
  video: "Видео",
  decoration: "Декор",
};
export const FONTS = {
  system: "Inter, system-ui, sans-serif",
  serif: "Georgia, serif",
  mono: "ui-monospace, monospace",
};
