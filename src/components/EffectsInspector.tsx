import {
  ANIMATIONS,
  HOVERS,
  DEFAULT_ANIMATION,
  DEFAULT_VISUAL,
  VISUAL_LIMITS,
  type Effects,
} from "../model/effects";
import { useProject } from "../state/ProjectContext";
import { Field, NumberField } from "./Fields";
function Range({
  label,
  value,
  min,
  max,
  step = 0.1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="effect-range">
        <input
          aria-label={`${label}, ползунок`}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <NumberField
          label={label}
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
export function EffectsInspector({
  id,
  effects,
  onChange,
}: {
  id: string;
  effects?: Effects;
  onChange: (effects: Effects) => void;
}) {
  const { showAnimations, setShowAnimations, playEffect } = useProject(),
    a = effects?.animation ?? DEFAULT_ANIMATION,
    v = effects?.visual ?? DEFAULT_VISUAL;
  const patch = (p: Partial<typeof a>) =>
    onChange({ ...effects, animation: { ...a, ...p } });
  return (
    <details className="effect-controls">
      <summary>Анимация и эффекты</summary>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={showAnimations}
          onChange={(e) => setShowAnimations(e.target.checked)}
        />
        Показывать анимации в редакторе
      </label>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={a.enabled}
          onChange={(e) => patch({ enabled: e.target.checked })}
        />
        Включить анимацию
      </label>
      <Field label="Тип анимации">
        <select
          value={a.type}
          onChange={(e) => patch({ type: e.target.value as typeof a.type })}
        >
          {Object.entries(ANIMATIONS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <details>
        <summary>Демонстрации эффектов</summary>
        <div className="effect-samples">
          {Object.entries(ANIMATIONS)
            .filter(([key]) => key !== "none")
            .map(([key, label]) => (
              <button
                key={key}
                aria-pressed={a.type === key}
                onClick={() => {
                  patch({ type: key as typeof a.type });
                  playEffect(id);
                }}
              >
                <span className={`effect-demo effect-animation anim-${key}`} />
                {label}
              </button>
            ))}
        </div>
      </details>
      {a.type !== "none" && (
        <>
          <Range
            label="Длительность цикла, с"
            value={a.duration}
            min={0.8}
            max={30}
            onChange={(duration) => patch({ duration })}
          />
          <Range
            label="Интенсивность"
            value={a.intensity}
            min={0}
            max={1}
            step={0.01}
            onChange={(intensity) => patch({ intensity })}
          />
          <Range
            label="Задержка, с"
            value={a.delay}
            min={0}
            max={30}
            onChange={(delay) => patch({ delay })}
          />
          <Field label="Повторения">
            <select
              value={a.repeat}
              onChange={(e) =>
                patch({ repeat: e.target.value as typeof a.repeat })
              }
            >
              <option value="once">Однократно</option>
              <option value="infinite">Бесконечно</option>
            </select>
          </Field>
          <Field label="Направление анимации">
            <select
              value={a.direction}
              onChange={(e) =>
                patch({ direction: e.target.value as typeof a.direction })
              }
            >
              <option value="normal">Обычное</option>
              <option value="reverse">Обратное</option>
              <option value="alternate">Туда и обратно</option>
            </select>
          </Field>
          {(a.type === "flicker" || a.type === "glitch") && (
            <small>
              Для безопасности цикл не короче 2 секунд. Мерцание не меняет
              яркость и снижает непрозрачность не более чем на 18%.
            </small>
          )}
        </>
      )}
      <div className="effect-preview-actions">
        <button onClick={() => playEffect(id)}>Воспроизвести анимацию</button>
        <button
          onClick={() =>
            onChange({
              ...effects,
              animation: { ...DEFAULT_ANIMATION, enabled: false },
            })
          }
        >
          Сбросить анимацию
        </button>
      </div>
      <Field label="Эффект при наведении">
        <select
          value={effects?.hover ?? "none"}
          onChange={(e) =>
            onChange({ ...effects, hover: e.target.value as Effects["hover"] })
          }
        >
          {Object.entries(HOVERS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <small>
        Наведение работает только с мышью. На сенсорном экране эффект отключён.
      </small>
      <details>
        <summary>Визуальные эффекты</summary>
        {(Object.keys(VISUAL_LIMITS) as (keyof typeof VISUAL_LIMITS)[]).map(
          (key) => (
            <Range
              key={key}
              label={
                {
                  glow: "Свечение",
                  shadow: "Тень",
                  blur: "Размытие",
                  brightness: "Яркость",
                  contrast: "Контрастность",
                  saturation: "Насыщенность",
                  hue: "Оттенок, °",
                  grayscale: "Оттенки серого",
                }[key]
              }
              value={v[key]}
              min={VISUAL_LIMITS[key][0]}
              max={VISUAL_LIMITS[key][1]}
              step={key === "hue" ? 1 : 0.1}
              onChange={(n) =>
                onChange({ ...effects, visual: { ...v, [key]: n } })
              }
            />
          ),
        )}
        <button
          onClick={() =>
            onChange({ ...effects, visual: { ...DEFAULT_VISUAL } })
          }
        >
          Сбросить визуальные эффекты
        </button>
      </details>
    </details>
  );
}
