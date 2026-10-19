import { createId } from "./id";
import { firstFree } from "./grid";
import { LABELS, type Block, type BlockType, type Project } from "./types";
export function newBlock(type: BlockType): Block {
  return {
    id: createId(),
    type,
    name: LABELS[type],
    content:
      type === "text"
        ? "Всё начинается с идеи."
        : type === "decoration"
          ? "✦"
          : "Открыть ссылку",
    url: type === "link" ? "https://example.com" : "",
    imageUrl: "",
    fit: "cover",
    background:
      type === "text"
        ? "#f2efeb"
        : type === "decoration"
          ? "#00000000"
          : "#222226",
    color: type === "text" ? "#0d0d0f" : "#ffffff",
    radius: 2,
    opacity: 1,
    borderWidth: 0,
    borderColor: "#ff3355",
    fontSize: type === "text" ? 26 : type === "decoration" ? 64 : 18,
    align: type === "text" ? "left" : "center",
    bold: type === "text",
    col: 0,
    row: 0,
    colSpan: type === "text" || type === "video" ? 2 : 1,
    rowSpan: type === "video" ? 2 : 1,
    x: 24,
    y: 24,
    width: 100,
    height: 100,
    rotation: -12,
    zIndex: 1,
  };
}
export const emptyProject = (): Project => ({
  version: 1,
  page: {
    title: "Моё пространство",
    background: "#0d0d0f",
    backgroundImage: "",
    columns: 4,
    gap: 16,
    maxWidth: 880,
    font: "system",
  },
  blocks: [],
});
export function demoProject(): Project {
  const project = emptyProject();
  const intro = {
    ...newBlock("text"),
    name: "Приветствие",
    content: "Привет, я Саша ✦\nСобираю идеи и создаю новое.",
    colSpan: 3,
    rowSpan: 2,
    fontSize: 30,
  };
  const link = {
    ...newBlock("link"),
    name: "Мои проекты",
    content: "Мои проекты",
    url: "https://github.com",
    background: "#ff3355",
    color: "#0d0d0f",
    col: 3,
    rowSpan: 2,
  };
  const note = {
    ...newBlock("text"),
    name: "Немного обо мне",
    content: "Маленькое пространство\nдля больших идей.",
    colSpan: 2,
    row: 2,
    rowSpan: 2,
    fontSize: 23,
    background: "#ffb6cf",
    color: "#0d0d0f",
  };
  const another = {
    ...newBlock("link"),
    name: "На связи",
    content: "Написать мне",
    url: "https://example.com",
    col: 2,
    row: 2,
    colSpan: 2,
    background: "#222226",
  };
  project.blocks = [intro, link, note, another];
  return project;
}
export function addBlock(
  project: Project,
  type: BlockType,
): { project: Project; id: string } {
  const raw = newBlock(type);
  if (type === "decoration")
    raw.zIndex =
      Math.max(
        0,
        ...project.blocks
          .filter((b) => b.type === "decoration")
          .map((b) => b.zIndex),
      ) + 1;
  const block =
    type === "decoration"
      ? raw
      : firstFree(
          raw,
          project.blocks.filter((b) => b.type !== "decoration"),
          project.page.columns,
        );
  return {
    project: { ...project, blocks: [...project.blocks, block] },
    id: block.id,
  };
}
