import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Starburst } from "../components/ui/Starburst";
import { Brand } from "../components/ui/Brand";
export function NotFound() {
  return (
    <div className="error-page">
      <header>
        <Brand />
        <span className="eyebrow">СТРАНИЦА НЕ НАЙДЕНА / 404</span>
      </header>
      <main>
        <span className="error-label">[ ССЫЛКА ВЕДЁТ В НИКУДА ]</span>
        <div className="error-number" aria-hidden="true">
          4
          <span>
            <Starburst />
          </span>
          4
        </div>
        <h1>ВЫ ВЫШЛИ ЗА РАМКИ.</h1>
        <p>
          Кажется, такой страницы нет.
          <br />
          Зато есть чистое полотно для ваших идей.
        </p>
        <div className="error-actions">
          <Link className="primary-button" to="/editor">
            Открыть редактор <ArrowUpRight size={20} />
          </Link>
          <Link className="secondary-button" to="/">
            <ArrowLeft size={16} />
            На главную
          </Link>
        </div>
      </main>
      <footer>
        <span>ОШИБКА 404 / СТРАНИЦА НЕ НАЙДЕНА</span>
        <span>ИЩИТЕ НОВОЕ. ОСТАВАЙТЕСЬ СОБОЙ.</span>
      </footer>
    </div>
  );
}
