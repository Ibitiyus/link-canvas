import { useEffect, useRef, useState } from "react";
import { Disc3, Pause, Play, Volume2, VolumeX } from "lucide-react";
import type { Block } from "../model/types";
import { audioSource } from "../model/media";
import { safeImageSource } from "../model/assets";
import { useAssetSource } from "../hooks/useAssetSource";
const time = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
export function AudioPlayer({ block }: { block: Block }) {
  const audio = useRef<HTMLAudioElement>(null);
  const { src, error, loading } = useAssetSource(audioSource(block.url));
  const cover = useAssetSource(safeImageSource(block.imageUrl));
  const [playing, setPlaying] = useState(false),
    [failed, setFailed] = useState(false);
  const [current, setCurrent] = useState(0),
    [duration, setDuration] = useState(0),
    [volume, setVolume] = useState(1);
  const [coverFailed, setCoverFailed] = useState(false);
  useEffect(() => {
    setPlaying(false);
    setFailed(false);
    setCurrent(0);
    setDuration(0);
  }, [src]);
  useEffect(() => setCoverFailed(false), [cover.src]);
  const toggle = async () => {
    if (!audio.current) return;
    if (!audio.current.paused) audio.current.pause();
    else
      try {
        await audio.current.play();
      } catch {
        setFailed(true);
      }
  };
  const enabled = !!src && !failed && !error;
  return (
    <div
      className={`audio-player ${playing ? "is-playing" : ""}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <audio
        ref={audio}
        src={src || undefined}
        preload="metadata"
        onLoadedMetadata={(event) =>
          setDuration(
            Number.isFinite(event.currentTarget.duration)
              ? event.currentTarget.duration
              : 0,
          )
        }
        onDurationChange={(event) =>
          setDuration(
            Number.isFinite(event.currentTarget.duration)
              ? event.currentTarget.duration
              : 0,
          )
        }
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setFailed(true)}
      />
      <div className="audio-track">
        <div className="audio-art">
          {cover.src && !coverFailed ? (
            <img src={cover.src} alt="" onError={() => setCoverFailed(true)} />
          ) : (
            <Disc3 size={42} />
          )}
        </div>
        <div className="audio-track-info">
          <small>ZIN / МУЗЫКА</small>
          <strong>{block.content || "Мой трек"}</strong>
          <span>
            {error
              ? "Файл не найден. Загрузите заново."
              : failed
                ? "Аудио недоступно или кодек не поддерживается"
                : loading
                  ? "Загрузка файла…"
                  : !src
                    ? block.url
                      ? "Нужна прямая ссылка на аудио"
                      : "Добавьте файл или ссылку"
                    : playing
                      ? "Сейчас играет"
                      : "Ваша личная звуковая дорожка"}
          </span>
        </div>
      </div>
      <div className="audio-transport">
        <button
          className="audio-play"
          aria-label={playing ? "Приостановить музыку" : "Воспроизвести музыку"}
          disabled={!enabled}
          onClick={toggle}
        >
          {playing ? (
            <Pause size={22} fill="currentColor" />
          ) : (
            <Play size={22} fill="currentColor" />
          )}
        </button>
        <div className="audio-progress">
          <input
            aria-label="Позиция музыки"
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={Math.min(current, duration || 1)}
            disabled={!enabled || !duration}
            onChange={(event) => {
              if (audio.current) {
                audio.current.currentTime = Number(event.target.value);
                setCurrent(Number(event.target.value));
              }
            }}
          />
          <div className="audio-time">
            <span>{time(current)}</span>
            <span>{time(duration)}</span>
          </div>
        </div>
      </div>
      <div className="audio-volume">
        <button
          aria-label={volume ? "Выключить звук музыки" : "Включить звук музыки"}
          onClick={() => {
            const next = volume ? 0 : 1;
            setVolume(next);
            if (audio.current) audio.current.volume = next;
          }}
        >
          {volume ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </button>
        <input
          aria-label="Громкость музыки"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(event) => {
            const next = Number(event.target.value);
            setVolume(next);
            if (audio.current) audio.current.volume = next;
          }}
        />
        <span>{Math.round(volume * 100)}%</span>
      </div>
    </div>
  );
}
