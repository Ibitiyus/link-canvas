import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Menu, X, MoveUpRight } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { Brand } from "../components/ui/Brand";
import { Showcase } from "../components/Showcase";
const features = [
  [
    "01",
    "СЕТКА — НЕ КЛЕТКА.",
    "Собирайте блоки по сетке. Или отпустите их в свободное положение.",
  ],
  [
    "02",
    "ВЕСЬ ВАШ ШУМ.",
    "Текст, фото, музыка, GIF, видео, ссылки, QR и декор. Восемь способов выразиться.",
  ],
  [
    "03",
    "СЛОЙ ЗА СЛОЕМ.",
    "Группируйте, вращайте, перекрывайте. Добавляйте движение и эффекты.",
  ],
  [
    "04",
    "ОДИН ZIN. ВЕЗДЕ.",
    "Ваша композиция сохраняет пропорции на телефоне и компьютере.",
  ],
];
export function Home() {
  const { session } = useAuth();
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!menu) return;
    document.querySelector<HTMLAnchorElement>("#home-navigation a")?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(false);
        document.querySelector<HTMLButtonElement>(".raw-menu-button")?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [menu]);
  return (
    <div className="raw-home home-page">
      <a className="skip-link" href="#home-main">
        К содержимому
      </a>
      <header className="raw-nav">
        <Brand />
        <span className="raw-edition">НЕЗАВИСИМЫЙ ВЕБ / VOL.06</span>
        <button
          className="raw-menu-button"
          aria-label={menu ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={menu}
          aria-controls="home-navigation"
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>
        <nav
          id="home-navigation"
          className={menu ? "is-open" : ""}
          aria-label="Основная навигация"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setMenu(false);
              document
                .querySelector<HTMLButtonElement>(".raw-menu-button")
                ?.focus();
            }
          }}
        >
          <Link to="/explore">Смотреть ZIN ↗</Link>
          <Link to="/templates">Шаблоны ↗</Link>
          <a href="#playground" onClick={() => setMenu(false)}>
            Попробовать
          </a>
          <Link to="/dashboard">{session ? "Мой аккаунт" : "Войти"}</Link>
        </nav>
      </header>
      <main id="home-main">
        <section className="raw-hero">
          <div className="raw-hero-label">
            <span>NO RULES / YOUR PAGE</span>
            <span aria-hidden="true">/// 001</span>
          </div>
          <div className="raw-hero-grid">
            <div className="raw-title">
              <h1 aria-label="САЙТ НЕ ОБЯЗАН БЫТЬ НОРМАЛЬНЫМ.">
                <span>САЙТ НЕ</span>
                <span>ОБЯЗАН</span>
                <span>БЫТЬ</span>
                <span className="raw-last-line">НОРМАЛЬНЫМ.</span>
              </h1>
            </div>
            <div className="raw-hero-aside">
              <div className="raw-signal-mark" aria-hidden="true">
                <span>×</span>
                <b>
                  RAW
                  <br />
                  SIGNAL
                </b>
                <i>СОБСТВЕННАЯ ЧАСТОТА</i>
              </div>
              <p>
                Личная страница из того, что вам важно. Без одинаковых профилей.
                С музыкой, фотографиями и вашим характером.
              </p>
              <span className="raw-materials">TEXT / PHOTO / MUSIC / GIF</span>
            </div>
          </div>
          <div className="raw-hero-bottom">
            <p>
              СОБЕРИ. СЛОМАЙ.
              <br />
              ПЕРЕДЕЛАЙ.
            </p>
            <div className="raw-actions">
              <Link
                className="primary-button"
                to="/editor"
                aria-label="Создать ZIN"
              >
                СОЗДАТЬ ZIN <ArrowUpRight />
              </Link>
              <Link className="secondary-button" to="/explore">
                СМОТРЕТЬ ZIN <ArrowUpRight />
              </Link>
            </div>
            <span className="raw-local-note">
              Начните без регистрации.
              <br />
              Ваш черновик остаётся у вас.
            </span>
          </div>
        </section>
        <section
          className="raw-playground"
          id="playground"
          aria-labelledby="product-title"
        >
          <div className="raw-section-heading">
            <span className="eyebrow">01 / ПОПРОБУЙТЕ РУКАМИ</span>
            <h2 id="product-title">
              НЕ СМОТРИ.
              <br />
              <em>ДВИГАЙ.</em>
            </h2>
            <p>
              Это настоящая песочница. Выберите блок, переместите, измените. Ваш
              сохранённый ZIN не изменится.
            </p>
          </div>
          <div className="raw-demo">
            <span className="raw-demo-caption">
              ЖИВОЙ ПРИМЕР / 8 ТИПОВ БЛОКОВ
            </span>
            <Showcase />
            <Link to="/editor">
              Открыть свой редактор <MoveUpRight size={18} />
            </Link>
          </div>
        </section>
        <section className="raw-features" aria-labelledby="features-title">
          <div className="raw-section-heading">
            <span className="eyebrow">02 / ИНСТРУМЕНТЫ, НЕ ПРАВИЛА</span>
            <h2 id="features-title">
              ТВОРЧЕСТВУ
              <br />
              ТЕСНО В ПРОФИЛЕ.
            </h2>
          </div>
          <div className="raw-feature-grid">
            {features.map(([n, title, text]) => (
              <article key={n}>
                <span>{n} ///</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="raw-templates">
          <div>
            <span className="eyebrow">
              03 / ГОТОВАЯ ОСНОВА — ВАШЕ ПРОДОЛЖЕНИЕ
            </span>
            <h2>
              ШАБЛОН —<br />
              <em>ТОЛЬКО НАЧАЛО.</em>
            </h2>
            <p>
              Cybercore, Punk Zine, Old Web и ещё пять композиций. Любой элемент
              можно изменить. Или начните с пустого полотна.
            </p>
            <Link className="secondary-button" to="/templates">
              Выбрать шаблон ↗
            </Link>
          </div>
          <div className="raw-template-links">
            <Link to="/templates/cybercore">
              <span>01 / ХРОМ И ШУМ</span>
              <strong>
                CYBER
                <br />
                CORE ↗
              </strong>
            </Link>
            <Link to="/templates/punk-zine">
              <span>02 / ВЫРЕЗАЙ И КЛЕЙ</span>
              <strong>
                PUNK
                <br />
                ZINE ↗
              </strong>
            </Link>
            <Link to="/templates/blank-canvas">
              <span>03 / НИЧЕГО ЛИШНЕГО</span>
              <strong>
                BLANK
                <br />
                CANVAS ↗
              </strong>
            </Link>
          </div>
        </section>
        <section className="raw-final">
          <span className="eyebrow">04 / ВАША ЧАСТОТА</span>
          <h2>
            MAKE
            <br />
            <span>SOMETHING.</span>
          </h2>
          <div>
            <p>
              Интернет может быть другим.
              <br />
              Начните со своей страницы.
            </p>
            <Link className="primary-button" to="/editor">
              СОЗДАТЬ ZIN <ArrowUpRight />
            </Link>
          </div>
        </section>
      </main>
      <footer className="raw-footer">
        <Brand />
        <p>
          НЕЗАВИСИМЫЙ ИНСТРУМЕНТ.
          <br />
          ДЛЯ ТЕХ, КТО ДЕЛАЕТ ПО-СВОЕМУ.
        </p>
        <nav aria-label="Ссылки в подвале">
          <Link to="/explore">Галерея</Link>
          <Link to="/templates">Шаблоны</Link>
          <Link to="/preview">Мой предпросмотр ↗</Link>
        </nav>
        <span>
          BUILT WITH ZIN
          <br />© 2026
        </span>
      </footer>
    </div>
  );
}
