import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

/** Pieces keep the parent action's single focus target and accessible name. */
export function Cutout({ children }: { children: ReactNode }) {
  return <span className="cutout-piece">{children}</span>;
}

export function CutoutLabel({ text }: { text: string }) {
  return (
    <>
      {text.split(" ").map((word, index) => (
        <Cutout key={index}>
          {word === "↗" ? <ArrowUpRight size={18} aria-hidden="true" /> : word}
        </Cutout>
      ))}
    </>
  );
}
