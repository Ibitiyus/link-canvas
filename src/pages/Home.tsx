import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Menu, X, MoveUpRight } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { Brand } from "../components/ui/Brand";
import { Cutout, CutoutLabel } from "../components/ui/Cutout";
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
        <span className="raw-edition">ISSUE 001 / XEROX RIOT</span>
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
        <section className="riot-hero">
          <div className="riot-hero-copy">
            <span className="riot-tag">ISSUE 001 / XEROX RIOT</span>
            <h1
              className="riot-headline"
              aria-label="САЙТ НЕ ОБЯЗАН БЫТЬ НОРМАЛЬНЫМ."
            >
              <span>
                <b className="cutword paper mono">САЙТ</b>{" "}
                <b className="cutword red">НЕ</b>
              </span>
              <span>
                <b className="cutword">ОБЯЗАН</b>
              </span>
              <span>
                <b className="cutword paper serif">БЫТЬ</b>
              </span>
              <span>
                <b className="cutword red serif">НОРМАЛЬ</b>
              </span>
              <span>
                <b className="cutword paper">НЫМ.</b>
              </span>
            </h1>
            <p className="riot-subtitle">
              TEXT / PHOTO / MUSIC / GIF / LINKS
              <br />
              СОБЕРИ. СЛОМАЙ. ПЕРЕДЕЛАЙ.
            </p>
            <div className="raw-actions">
              <Link
                className="cutout-button primary"
                to="/editor"
                aria-label="Создать ZIN"
              >
                <CutoutLabel text="СОЗДАТЬ ZIN" />
                <Cutout>
                  <ArrowUpRight />
                </Cutout>
              </Link>
              <Link className="cutout-button secondary" to="/explore">
                <CutoutLabel text="СМОТРЕТЬ ZIN" />
                <Cutout>
                  <ArrowUpRight />
                </Cutout>
              </Link>
            </div>
            <p className="riot-micro">
              Начните без регистрации. Ваш черновик остаётся у вас.
              <br />
              NO TEMPLATE / YOUR PAGE / CUT &amp; PASTE INTERNET
            </p>
          </div>
          <div
            className="riot-collage"
            role="img"
            aria-label="Ксерокс-коллаж: вырезки, афиша, музыка и собственная страница"
          >
            <img
              className="riot-art-main"
              src="/templates/v1/architecture.webp"
              alt=""
            />
            <div className="riot-art-row">
              <img src="/demo/poster.svg" alt="" />
              <p>
                running round
                <br />
                the whole city /<br />
                <i>make a little noise.</i>
              </p>
            </div>
            <div className="riot-art-bottom">
              <span>✳</span>
              <img src="/templates/previews/punk-zine.png" alt="" />
            </div>
            <div className="riot-sticker one">
              <b className="cutword paper mono">YOUR</b>
              <b className="cutword">ZIN_</b>
            </div>
            <div className="riot-sticker two">
              <b className="cutword red">YOUR</b>
              <b className="cutword">PAGE</b>
            </div>
            <div className="riot-sticker three">
              <b className="cutword red">IS THERE ANYONE</b>
              <b className="cutword">OUT THERE?</b>
            </div>
            <span className="riot-rec">● REC</span>
          </div>
        </section>
        <div className="riot-strip">
          ✳ CUT / PASTE / PUBLISH ✳ ALL PAGES SHOULDN’T LOOK THE SAME ✳ YOUR
          PAGE / YOUR RULES ✳
        </div>
        <section className="riot-samples" aria-labelledby="samples-title">
          <span className="riot-tag">01 / ПРИМЕРЫ</span>
          <h2 id="samples-title">
            ZIN НЕ ДОЛЖНЫ БЫТЬ
            <br />
            <span className="cutword red">ОПРЯТНЫМИ.</span>
          </h2>
          <div className="riot-sample-grid">
            {[
              ["punk-zine", "CUT MY WIRES", "TEXT + LINKS"],
              ["music-artist", "LOUD ENOUGH", "MUSIC + PHOTO"],
              ["photographer", "NO MORE POLITE", "PHOTO + STORIES"],
            ].map(([id, title, type]) => (
              <Link className="riot-sample" to={`/templates/${id}`} key={id}>
                <span className="riot-micro">КОМПОЗИЦИЯ / {type}</span>
                <h3>{title} ↗</h3>
                <img
                  src={`/templates/previews/${id}.png`}
                  alt={`Пример композиции ${title}`}
                  loading="lazy"
                />
                <span className="riot-micro">
                  ОТКРЫТЬ И ПЕРЕДЕЛАТЬ ПОД СЕБЯ ↗
                </span>
              </Link>
            ))}
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
            ХВАТИТ
            <br />
            <span>СМОТРЕТЬ.</span>
          </h2>
          <div>
            <p>
              Интернет может быть другим.
              <br />
              Начните со своей страницы.
            </p>
            <Link
              className="cutout-button secondary"
              to="/editor"
              aria-label="Собери свой ZIN"
            >
              <CutoutLabel text="СОЗДАТЬ ZIN" />
              <Cutout>
                <ArrowUpRight aria-hidden="true" />
              </Cutout>
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
