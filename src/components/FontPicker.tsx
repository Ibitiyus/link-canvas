import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { LoaderCircle, Trash2, Upload } from "lucide-react";
import { BUILTIN_FONTS } from "../model/fonts";
import { MAX_CUSTOM_FONTS } from "../model/assets";
import { readFontFile } from "../model/uploads";
import type { Block } from "../model/types";
import { useProject } from "../state/ProjectContext";
import { Field } from "./Fields";
export function FontPicker({ block }: { block: Block }) {
  const { project, change, updateBlock, notify } = useProject();
  const input = useRef<HTMLInputElement>(null),
    token = useRef(0);
  const [busy, setBusy] = useState(false);
  useEffect(
    () => () => {
      token.current++;
    },
    [],
  );
  const fonts = project.customFonts ?? [];
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const request = ++token.current;
    setBusy(true);
    try {
      const font = await readFontFile(file);
      if (token.current !== request) return;
      change((p) => {
        const existing = p.customFonts?.find(
          (existing) => existing.dataUrl === font.dataUrl,
        );
        if (!existing && (p.customFonts?.length ?? 0) >= MAX_CUSTOM_FONTS)
          return p;
        const id = existing?.id ?? font.id;
        return {
          ...p,
          customFonts: existing
            ? p.customFonts
            : [...(p.customFonts ?? []), font],
          blocks: p.blocks.map((item) =>
            item.id === block.id ? { ...item, fontFamily: `font:${id}` } : item,
          ),
        };
      });
    } catch (error) {
      if (token.current === request)
        notify(
          error instanceof Error
            ? error.message
            : "Не удалось установить шрифт.",
        );
    } finally {
      if (token.current === request) setBusy(false);
    }
  };
  const remove = (id: string) =>
    change((p) => ({
      ...p,
      customFonts: p.customFonts?.filter((font) => font.id !== id),
      blocks: p.blocks.map((item) =>
        item.fontFamily === `font:${id}`
          ? { ...item, fontFamily: undefined }
          : item,
      ),
    }));
  return (
    <div className="font-picker">
      <Field label="Шрифт блока">
        <select
          value={block.fontFamily ?? "inherit"}
          onChange={(event) =>
            updateBlock(block.id, {
              fontFamily:
                event.target.value === "inherit"
                  ? undefined
                  : event.target.value,
            })
          }
        >
          <option value="inherit">Как у страницы</option>
          <optgroup label="Встроенные">
            {Object.entries(BUILTIN_FONTS).map(([id, font]) => (
              <option key={id} value={id}>
                {font.label}
              </option>
            ))}
          </optgroup>
          {!!fonts.length && (
            <optgroup label="Установленные">
              {fonts.map((font) => (
                <option key={font.id} value={`font:${font.id}`}>
                  {font.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </Field>
      <input
        ref={input}
        hidden
        type="file"
        accept=".woff2,.woff,.ttf,.otf"
        disabled={busy || fonts.length >= MAX_CUSTOM_FONTS}
        aria-label="Файл шрифта"
        onChange={upload}
      />
      <button
        className="secondary-button install-font"
        disabled={busy || fonts.length >= MAX_CUSTOM_FONTS}
        onClick={() => input.current?.click()}
      >
        {busy ? (
          <LoaderCircle size={14} className="spin" />
        ) : (
          <Upload size={14} />
        )}
        {busy ? "Проверка шрифта…" : "Установить шрифт"}
      </button>
      <p className="muted caption upload-hint">
        WOFF2, WOFF, TTF, OTF · до 1 МБ. До 8 шрифтов в проекте. Кириллица
        зависит от выбранного файла.
      </p>
      {!!fonts.length && (
        <ul className="installed-fonts" aria-label="Установленные шрифты">
          {fonts.map((font) => (
            <li key={font.id}>
              <span title={font.name}>{font.name}</span>
              <button
                title={`Удалить шрифт: ${font.name}`}
                aria-label={`Удалить шрифт: ${font.name}`}
                onClick={() => remove(font.id)}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
