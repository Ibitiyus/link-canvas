import { usePageLoading } from "./PagePreloader";
import { useEffect, useRef } from "react";
import type { CustomFont } from "../model/types";
import { isCloudRef } from "../cloud/projectAssets";
import { assetBlob } from "../cloud/assets";
import { safeUrl } from "../model/media";
import { useProject } from "../state/ProjectContext";
import { getFile, isAssetRef } from "../model/fileStore";
import { customFontFamily } from "../model/fonts";
interface Entry {
  dataUrl: string;
  promise: Promise<FontFace>;
  face?: FontFace;
}
/** FontFace avoids injecting user-provided CSS and restores embedded fonts on every route. */
export function ProjectFonts() {
  const { project, notify } = useProject();
  return <FontFaces fonts={project.customFonts} onError={notify} />;
}
export function FontFaces({
  fonts,
  onError,
}: {
  fonts?: CustomFont[];
  onError?: (message: string) => void;
}) {
  const begin = usePageLoading();
  const entries = useRef(new Map<string, Entry>());
  useEffect(() => {
    let active = true;
    const finish = begin?.();
    const pending: Promise<unknown>[] = [];
    let failed = false;
    const currentFonts = fonts ?? [];
    for (const [id, entry] of entries.current) {
      if (
        !currentFonts.some(
          (font) => font.id === id && font.dataUrl === entry.dataUrl,
        )
      ) {
        if (entry.face) document.fonts.delete(entry.face);
        entries.current.delete(id);
      }
    }
    for (const font of currentFonts) {
      let entry = entries.current.get(font.id);
      if (!entry) {
        const promise = (async () => {
          const source = isCloudRef(font.dataUrl)
            ? await (await assetBlob(font.dataUrl)).arrayBuffer()
            : isAssetRef(font.dataUrl)
              ? await (await getFile(font.dataUrl)).blob.arrayBuffer()
              : `url(${JSON.stringify(safeUrl(font.dataUrl) ?? font.dataUrl)})`;
          return new FontFace(customFontFamily(font.id), source).load();
        })();
        entry = { dataUrl: font.dataUrl, promise };
        entries.current.set(font.id, entry);
      }
      const current = entry;
      pending.push(
        current.promise
          .then((face) => {
            if (active) {
              current.face = face;
              document.fonts.add(face);
            }
          })
          .catch(() => {
            failed = true;
            if (active)
              onError?.(
                `Не удалось восстановить шрифт «${font.name}». Выберите другой шрифт или установите файл заново.`,
              );
          }),
      );
    }
    Promise.all(pending).then(() => {
      if (active) finish?.(failed);
    });
    return () => {
      active = false;
      finish?.();
    };
  }, [fonts, onError, begin]);
  useEffect(
    () => () => {
      for (const entry of entries.current.values())
        if (entry.face) document.fonts.delete(entry.face);
    },
    [],
  );
  return null;
}
