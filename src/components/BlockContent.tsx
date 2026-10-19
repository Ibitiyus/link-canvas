import { useEffect, useState, type CSSProperties } from "react";
import { ArrowUpRight, ImageIcon, Play, TriangleAlert } from "lucide-react";
import { safeUrl, videoSource } from "../model/media";
import { safeImageSource } from "../model/assets";
import { resolveBlockFont } from "../model/fonts";
import { useAssetSource } from "../hooks/useAssetSource";
import { AudioPlayer } from "./AudioPlayer";
import type { Block } from "../model/types";

export function RemoteImage({
  url,
  fit,
  alt,
}: {
  url: string;
  fit: "cover" | "contain";
  alt: string;
}) {
  const { src, error, loading } = useAssetSource(safeImageSource(url));
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url, src]);
  if (!src || failed || error)
    return (
      <div className="media-placeholder">
        <ImageIcon size={28} />
        <span>
          {loading
            ? "Загрузка файла…"
            : error
              ? "Файл не найден. Загрузите заново."
              : failed
                ? "Не удалось загрузить изображение"
                : url
                  ? "Нужен корректный HTTP(S) URL"
                  : "Добавьте URL изображения"}
        </span>
      </div>
    );
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      style={{ objectFit: fit }}
      onError={() => setFailed(true)}
    />
  );
}
function Video({ block }: { block: Block }) {
  const source = videoSource(block.url);
  const file = useAssetSource(source?.kind === "file" ? source.src : null);
  const poster = useAssetSource(safeImageSource(block.imageUrl));
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [block.url, file.src]);
  if (!source || failed || file.error || (source.kind === "file" && !file.src))
    return (
      <div className="media-placeholder">
        {failed ? <TriangleAlert size={28} /> : <Play size={28} />}
        <span>
          {file.loading
            ? "Загрузка файла…"
            : file.error
              ? "Файл не найден. Загрузите заново."
              : failed
                ? "Видео недоступно"
                : block.url
                  ? "Нужна ссылка YouTube или файл MP4, WebM, OGV"
                  : "Добавьте URL видео"}
        </span>
      </div>
    );
  if (source.kind === "youtube")
    return (
      <iframe
        title={block.name || "YouTube-видео"}
        src={source.src}
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation"
      />
    );
  return (
    <video
      src={file.src}
      poster={poster.src || undefined}
      controls
      preload="metadata"
      playsInline
      style={{ objectFit: block.fit }}
      onError={() => setFailed(true)}
    />
  );
}
export function blockStyle(block: Block): CSSProperties {
  return {
    background: block.background,
    color: block.color,
    borderRadius: block.radius,
    opacity: block.opacity,
    border: `${block.borderWidth}px solid ${block.borderColor}`,
    fontSize: block.fontSize,
    fontFamily:
      block.type === "text" ? resolveBlockFont(block.fontFamily) : undefined,
    textAlign: block.align,
    fontWeight: block.bold ? 700 : 400,
  };
}
export function BlockContent({
  block,
  editing = false,
}: {
  block: Block;
  editing?: boolean;
}) {
  const style = blockStyle(block);
  const alignment = {
    justifyContent:
      block.align === "left"
        ? "flex-start"
        : block.align === "right"
          ? "flex-end"
          : "center",
  };
  let content;
  if (block.type === "text")
    content = (
      <div className="text-content">{block.content || "Ваш текст"}</div>
    );
  else if (block.type === "image" || block.type === "gif")
    content = <RemoteImage url={block.url} fit={block.fit} alt={block.name} />;
  else if (block.type === "video") content = <Video block={block} />;
  else if (block.type === "audio") content = <AudioPlayer block={block} />;
  else if (block.type === "decoration")
    content = block.imageUrl ? (
      <RemoteImage url={block.imageUrl} fit={block.fit} alt={block.name} />
    ) : (
      <div className="decoration-content" style={alignment}>
        {block.content || "✦"}
      </div>
    );
  else {
    const url = safeUrl(block.url);
    const inner = (
      <>
        {block.imageUrl && (
          <div className="link-image">
            <RemoteImage url={block.imageUrl} fit={block.fit} alt="" />
          </div>
        )}
        <span>{block.content || "Открыть ссылку"}</span>
        <ArrowUpRight className="link-arrow" size={20} />
      </>
    );
    content =
      !editing && url ? (
        <a
          className="link-content"
          style={alignment}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {inner}
        </a>
      ) : (
        <div className="link-content" style={alignment}>
          {inner}
          {!url && <small>Некорректный URL</small>}
        </div>
      );
  }
  return (
    <div
      className={`block-content type-${block.type} ${editing ? "editing" : ""}`}
      style={style}
    >
      {content}
    </div>
  );
}
