import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { LoaderCircle, Upload, X } from "lucide-react";
import { Field } from "./Fields";
import { useProject } from "../state/ProjectContext";
import { readImageFile } from "../model/uploads";
import { safeImageSource } from "../model/assets";
export function ImageInput({
  label,
  value,
  onChange,
  hint = "URL или файл PNG, JPEG, WebP, GIF",
}: {
  label: string;
  value: string;
  onChange: (source: string) => void;
  hint?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const token = useRef(0);
  const [busy, setBusy] = useState(false);
  const { notify } = useProject();
  useEffect(
    () => () => {
      token.current++;
    },
    [],
  );
  const embedded = value.startsWith("data:");
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const request = ++token.current;
    setBusy(true);
    try {
      const source = await readImageFile(file);
      if (token.current === request) onChange(source);
    } catch (error) {
      if (token.current === request)
        notify(
          error instanceof Error
            ? error.message
            : "Не удалось загрузить изображение.",
        );
    } finally {
      if (token.current === request) setBusy(false);
    }
  };
  return (
    <div className="image-input">
      <Field
        label={label}
        hint={embedded ? "Файл с устройства сохранён внутри проекта." : hint}
      >
        <input
          type="url"
          value={embedded ? "" : value}
          placeholder={embedded ? "Используется загруженный файл" : "https://…"}
          maxLength={2048}
          disabled={busy}
          onChange={(event) => onChange(event.target.value)}
        />
      </Field>
      <input
        ref={input}
        type="file"
        hidden
        accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
        aria-label={`Файл: ${label}`}
        disabled={busy}
        onChange={upload}
      />
      <div className="asset-actions">
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {busy ? (
            <LoaderCircle size={14} className="spin" />
          ) : (
            <Upload size={14} />
          )}
          {busy ? "Подготовка…" : "Загрузить с устройства"}
        </button>
        {value && (
          <button
            className="icon-button"
            disabled={busy}
            title={`Удалить: ${label}`}
            aria-label={`Удалить: ${label}`}
            onClick={() => onChange("")}
          >
            <X size={15} />
          </button>
        )}
      </div>
      {value && !safeImageSource(value) && (
        <p className="field-error">
          Нужен корректный URL или поддерживаемый файл изображения.
        </p>
      )}
    </div>
  );
}
