import { useEffect, useRef } from "react";
import { useProject } from "../state/ProjectContext";
import { customFontFamily } from "../model/fonts";
interface Entry {
  dataUrl: string;
  promise: Promise<FontFace>;
  face?: FontFace;
}
/** FontFace avoids injecting user-provided CSS and restores embedded fonts on every route. */
export function ProjectFonts() {
  const { project, notify } = useProject();
  const entries = useRef(new Map<string, Entry>());
  useEffect(() => {
    let active = true;
    const fonts = project.customFonts ?? [];
    for (const [id, entry] of entries.current) {
      if (
        !fonts.some((font) => font.id === id && font.dataUrl === entry.dataUrl)
      ) {
        if (entry.face) document.fonts.delete(entry.face);
        entries.current.delete(id);
      }
    }
    for (const font of fonts) {
      let entry = entries.current.get(font.id);
      if (!entry) {
        const face = new FontFace(
          customFontFamily(font.id),
          `url("${font.dataUrl}")`,
        );
        entry = { dataUrl: font.dataUrl, promise: face.load() };
        entries.current.set(font.id, entry);
      }
      const current = entry;
      current.promise
        .then((face) => {
          if (active) {
            current.face = face;
            document.fonts.add(face);
          }
        })
        .catch(() => {
          if (active)
            notify(
              `Не удалось восстановить шрифт «${font.name}». Выберите другой шрифт или установите файл заново.`,
            );
        });
    }
    return () => {
      active = false;
    };
  }, [project.customFonts, notify]);
  useEffect(
    () => () => {
      for (const entry of entries.current.values())
        if (entry.face) document.fonts.delete(entry.face);
    },
    [],
  );
  return null;
}
