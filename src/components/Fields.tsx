import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {isValidElement<{ id?: string; "aria-describedby"?: string }>(children)
        ? cloneElement(children, {
            id,
            "aria-describedby": hint ? `${id}-hint` : undefined,
          })
        : children}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 2000,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <Field label={label}>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          if (next !== "") {
            const n = Number(next);
            if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
          }
        }}
        onBlur={() => {
          const n = draft === "" ? value : Number(draft);
          const committed = Number.isFinite(n)
            ? Math.max(min, Math.min(max, n))
            : value;
          setDraft(String(committed));
          onChange(committed);
        }}
      />
    </Field>
  );
}
export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <span className="color-input">
        <input
          id={id}
          type="color"
          value={value.slice(0, 7)}
          onChange={(event) => onChange(event.target.value)}
        />
        <span>{value.toUpperCase()}</span>
      </span>
    </div>
  );
}
