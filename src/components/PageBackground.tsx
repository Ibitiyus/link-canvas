import { usePageLoading } from "./PagePreloader";
import { useAssetSource } from "../hooks/useAssetSource";
import { safeImageSource } from "../model/assets";
import type { PageSettings } from "../model/types";

/** The visitor's background belongs to the viewport, never to canvas zoom. */
export function PageBackground({ page }: { page: PageSettings }) {
  const loading = usePageLoading();
  const { src } = useAssetSource(safeImageSource(page.backgroundImage));
  return (
    <>
      {loading && src && (
        <img
          className="page-background-preload"
          src={src}
          alt=""
          aria-hidden="true"
        />
      )}
      <div
        className="page-background"
        aria-hidden="true"
        style={{
          backgroundColor: page.background,
          backgroundImage: src ? `url(${JSON.stringify(src)})` : undefined,
        }}
      />
    </>
  );
}
