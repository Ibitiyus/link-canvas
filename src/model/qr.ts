import QRCode from "qrcode";
import { safeUrl } from "./media";

export type QRResult =
  | { url: string; size: number; path: string; error?: never }
  | { error: string; url?: never; size?: never; path?: never };

/** Encode locally; the destination never goes to a third-party QR service. */
export function createQR(value: string): QRResult {
  const url = safeUrl(value);
  if (!url)
    return {
      error: "Введите корректную ссылку, начиная с https:// или http://.",
    };
  try {
    const { modules } = QRCode.create(url, { errorCorrectionLevel: "M" });
    const paths: string[] = [];
    for (let row = 0; row < modules.size; row++) {
      let col = 0;
      while (col < modules.size) {
        if (!modules.get(row, col)) {
          col++;
          continue;
        }
        const start = col;
        while (col < modules.size && modules.get(row, col)) col++;
        paths.push(`M${start} ${row}h${col - start}v1H${start}z`);
      }
    }
    return { url, size: modules.size, path: paths.join("") };
  } catch {
    return {
      error:
        "Ссылка слишком длинная для QR-кода. Используйте более короткий адрес.",
    };
  }
}
