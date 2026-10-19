import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="Link Canvas — главная">
      <span className="brand-mark" aria-hidden="true">
        <ArrowUpRight size={24} strokeWidth={2.5} />
      </span>
      <span className="brand-wordmark">
        LINK<span className="brand-slash">/</span>CANVAS
        <span className="brand-asterisk" aria-hidden="true">
          +
        </span>
      </span>
    </Link>
  );
}
