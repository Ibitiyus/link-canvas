import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

export function ZinFooter() {
  return (
    <footer className="zin-footer">
      <Link to="/" className="zin-footer-link">
        Создать свой зин <ArrowUpRight size={16} aria-hidden="true" />
      </Link>
    </footer>
  );
}
