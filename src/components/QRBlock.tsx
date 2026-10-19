import { useMemo } from "react";
import { QrCode } from "lucide-react";
import { createQR } from "../model/qr";
import type { Block } from "../model/types";

export function QRBlock({
  block,
  editing,
}: {
  block: Block;
  editing: boolean;
}) {
  const code = useMemo(() => createQR(block.url), [block.url]);
  if (code.error !== undefined)
    return (
      <div className="media-placeholder">
        <QrCode size={28} />
        <span>{block.url ? code.error : "Добавьте ссылку для QR-кода"}</span>
      </div>
    );
  const svg = (
    <svg
      className="qr-code"
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`-4 -4 ${code.size + 8} ${code.size + 8}`}
      role="img"
      aria-label={`QR-код для ${code.url}`}
      shapeRendering="crispEdges"
    >
      <rect
        x={-4}
        y={-4}
        width={code.size + 8}
        height={code.size + 8}
        fill={block.background}
      />
      <path d={code.path} fill={block.color} />
    </svg>
  );
  return editing ? (
    <div className="qr-content">{svg}</div>
  ) : (
    <a
      className="qr-content"
      href={code.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Открыть ссылку: ${block.name || "QR-код"}`}
      title={code.url}
    >
      {svg}
    </a>
  );
}
