import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Grid2X2,
  Layers,
  MousePointer2,
  MoveUpRight,
  Sparkles,
} from "lucide-react";
export function Home() {
  return (
    <div className="home-page">
      <nav className="home-nav">
        <Link className="brand" to="/">
          <span className="brand-mark">
            <ArrowUpRight size={22} />
          </span>
          <span>
            link<span className="brand-light">canvas</span>
          </span>
        </Link>
        <Link className="secondary-button" to="/editor">
          Открыть редактор <ArrowUpRight size={15} />
        </Link>
      </nav>
      <main className="home-main">
        <section className="home-copy">
          <div className="pill">
            <Sparkles size={13} /> Ваш маленький уголок интернета
          </div>
          <h1>
            Больше, чем
            <br />
            просто <span>ссылка.</span>
          </h1>
          <p>
            Ссылки, мысли, фотографии и видео.
            <br />
            Соберите всё важное на одной странице —<br />
            такой же уникальной, как вы.
          </p>
          <Link className="primary-button hero-button" to="/editor">
            Создать своё пространство <ArrowRight size={18} />
          </Link>
          <span className="home-footnote">
            <Check size={13} /> Без регистрации · сохраняется в браузере
          </span>
        </section>
        <div className="home-art" aria-hidden="true">
          <div className="art-toolbar">
            <span />
            <span />
            <span />
            <b>Моё пространство</b>
            <i>
              <Check size={11} /> Сохранено
            </i>
          </div>
          <div className="art-grid">
            <div className="art-intro">
              <span>✳</span>
              <h2>Привет, я Саша.</h2>
              <p>
                Собираю идеи.
                <br />
                Создаю новое.
              </p>
            </div>
            <div className="art-link">
              Мои
              <br />
              проекты <ArrowUpRight size={26} />
            </div>
            <div className="art-note">
              Маленькое пространство
              <br />
              для больших идей. <span>✦</span>
            </div>
            <div className="art-small">
              На связи <ArrowUpRight size={21} />
            </div>
            <div className="art-empty">+</div>
          </div>
          <div className="art-cursor">
            <MousePointer2 size={24} fill="#a78bfa" />
            <span>Вы</span>
          </div>
          <div className="art-spark">✦</div>
        </div>
      </main>
      <div className="home-features">
        <span>
          <Grid2X2 size={17} /> Свободная сетка
        </span>
        <span>
          <Layers size={17} /> Шесть типов блоков
        </span>
        <span>
          <MoveUpRight size={17} /> Ваш стиль, ваши правила
        </span>
      </div>
      <footer className="home-footer">
        <span>Link Canvas · пространство для ваших идей</span>
        <Link to="/preview">
          Мой предпросмотр <ArrowUpRight size={13} />
        </Link>
      </footer>
    </div>
  );
}
