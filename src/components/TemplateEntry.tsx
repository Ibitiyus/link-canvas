import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
const SaveDialog = lazy(() => import("./SaveTemplateDialog"));
export function TemplateEntry() {
  const [open, setOpen] = useState(false);
  return (
    <div className="template-entry">
      <Link to="/templates?from=editor">Шаблоны ↗</Link>
      <button onClick={() => setOpen(true)}>Сохранить как шаблон</button>
      {open && (
        <Suspense fallback={<span role="status">Загрузка…</span>}>
          <SaveDialog onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
