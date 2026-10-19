import type { Project } from "../model/types";
export const isCloudRef = (value: string) =>
  /^cloud:[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp|gif|mp4|webm|ogg|mov|mp3|wav|m4a|aac|flac|woff2?|ttf|otf)$/.test(
    value,
  );
export function projectSources(project: Project): string[] {
  return [
    project.page.backgroundImage,
    ...(project.customFonts ?? []).map((font) => font.dataUrl),
    ...project.blocks.flatMap((block) => [
      block.imageUrl,
      ...(["image", "gif", "video", "audio"].includes(block.type)
        ? [block.url]
        : []),
    ]),
  ].filter(Boolean);
}
export function mapProjectSources(
  project: Project,
  replace: (source: string) => string,
): Project {
  return {
    ...project,
    page: {
      ...project.page,
      backgroundImage: replace(project.page.backgroundImage),
    },
    ...(project.customFonts
      ? {
          customFonts: project.customFonts.map((font) => ({
            ...font,
            dataUrl: replace(font.dataUrl),
          })),
        }
      : {}),
    blocks: project.blocks.map((block) => ({
      ...block,
      imageUrl: replace(block.imageUrl),
      url: ["image", "gif", "video", "audio"].includes(block.type)
        ? replace(block.url)
        : block.url,
    })),
  };
}
