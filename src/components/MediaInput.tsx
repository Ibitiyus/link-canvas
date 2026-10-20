import { isCloudRef } from "../cloud/projectAssets";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Upload, LoaderCircle, X } from "lucide-react";
import { readMediaFile } from "../model/uploads";
import { isAssetRef } from "../model/fileStore";
import { audioSource, videoSource } from "../model/media";
import { useProject } from "../state/ProjectContext";
import { Field } from "./Fields";
export function MediaInput({
  kind,
  value,
  onChange,
}: {
  kind: "audio" | "video";
  value: string;
  onChange: (value: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null),
    token = useRef(0);
  const [busy, setBusy] = useState(false);
  const { notify } = useProject();
  useEffect(
    () => () => {
      token.current++;
    },
    [],
  );
  const local = isAssetRef(value) || isCloudRef(value),
    label = kind === "video" ? "Ссылка на видео" : "Ссылка на музыку";
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const request = ++token.current;
    setBusy(true);
    try {
      const source = await readMediaFile(file, kind);
      if (token.current === request) onChange(source);
    } catch (error) {
      if (token.current === request)
        notify(
          error instanceof Error ? error.message : "Не удалось загрузить файл.",
        );
    } finally {
      if (token.current === request) setBusy(false);
    }
  };
  return (
    <div className="image-input">
      <Field
        label={label}
        hint={
          local
            ? "Файл выбран. Экспорт JSON включает файл; статус облака показан отдельно."
            : kind === "video"
              ? "YouTube или прямая ссылка на видеофайл"
              : "Прямая HTTP(S) ссылка на аудиофайл или аудиопоток"
        }
      >
        <input
          type="url"
          maxLength={2048}
          disabled={busy}
          value={local ? "" : value}
          placeholder={local ? "Используется загруженный файл" : "https://…"}
          onChange={(event) => onChange(event.target.value)}
        />
      </Field>
      <input
        ref={input}
        hidden
        type="file"
        aria-label={kind === "video" ? "Файл видео" : "Файл музыки"}
        disabled={busy}
        accept={
          kind === "video"
            ? ".mp4,.m4v,.webm,.ogv,.ogg,.mov"
            : ".mp3,.wav,.ogg,.oga,.opus,.m4a,.aac,.flac,.webm"
        }
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
          {busy ? "Проверка файла…" : "Загрузить с устройства"}
        </button>
        {value && (
          <button
            className="icon-button"
            disabled={busy}
            aria-label={`Удалить: ${label}`}
            onClick={() => onChange("")}
          >
            <X size={15} />
          </button>
        )}
      </div>
      <p className="muted caption">
        Без ограничения размера со стороны приложения. Доступный объём зависит
        от хранилища браузера; кодек должен поддерживаться устройством.
      </p>
      {value &&
        !(kind === "video" ? videoSource(value) : audioSource(value)) && (
          <p className="field-error">
            {kind === "video"
              ? "Эта ссылка на видео не поддерживается."
              : "Нужна прямая ссылка на аудио. Ссылки на страницы YouTube, Spotify и SoundCloud не являются аудиофайлами."}
          </p>
        )}
    </div>
  );
}
