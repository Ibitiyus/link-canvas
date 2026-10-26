import { Link } from "react-router-dom";
import { Brand } from "../components/ui/Brand";
import { ServiceArrow } from "../components/ui/ServiceArrow";
export default function Templates() {
  return (
    <div className="templates-page">
      <header className="templates-nav">
        <Brand />
        <Link to="/">На главную</Link>
        <Link to="/editor">
          В редактор <ServiceArrow />
        </Link>
      </header>
      <main>
        <div className="templates-heading">
          <span className="eyebrow">ВАША ТОЧКА ОТСЧЁТА</span>
          <h1>ШАБЛОНЫ</h1>
        </div>
        <section className="template-empty" aria-label="Шаблоны">
          <p>Пока здесь пусто.</p>
          <Link className="primary-button" to="/editor">
            Создать свой ZIN <ServiceArrow />
          </Link>
        </section>
      </main>
    </div>
  );
}
