import { Link } from "react-router-dom";
import { ServiceArrow } from "./ui/ServiceArrow";
export function TemplateEntry() {
  return (
    <div className="template-entry">
      <Link to="/templates?from=editor">
        Шаблоны <ServiceArrow />
      </Link>
    </div>
  );
}
