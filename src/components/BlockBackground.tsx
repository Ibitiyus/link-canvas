import { ColorField, Field, NumberField } from "./Fields";
import {
  backgroundTransparency,
  withBackgroundTransparency,
} from "../model/background";
export function BlockBackground({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const transparency = backgroundTransparency(value);
  const change = (percent: number) =>
    onChange(withBackgroundTransparency(value, percent));
  return (
    <>
      <ColorField
        label="Фон блока"
        value={value}
        onChange={(color) => onChange(color + value.slice(7))}
      />
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={value.length === 9 && value.slice(7) === "00"}
          onChange={(event) => change(event.target.checked ? 100 : 0)}
        />
        Прозрачный фон
      </label>
      <NumberField
        label="Прозрачность фона, %"
        value={transparency}
        max={100}
        onChange={change}
      />
      <Field
        label="Ползунок прозрачности фона"
        hint="0% — непрозрачный фон, 100% — полностью прозрачный. Содержимое и рамка не меняются."
      >
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={transparency}
          onChange={(event) => change(Number(event.target.value))}
        />
      </Field>
    </>
  );
}
