/** A vector mark keeps the brand accent independent of OS emoji rendering. */
export function Starburst({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M50 0v100M0 50h100M15 15l70 70M15 85l70-70"
        stroke="currentColor"
        strokeWidth="13"
      />
    </svg>
  );
}
