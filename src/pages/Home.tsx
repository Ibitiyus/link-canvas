import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  MoveUpRight,
} from "lucide-react";
import { Starburst } from "../components/ui/Starburst";
import { Brand } from "../components/ui/Brand";
import { Showcase } from "../components/Showcase";
const features = [
  {
    number: "01",
    title: "GRID BASED\nEDITOR",
    text: "Собирайте страницу из блоков. Перемещайте, меняйте размеры — сетка найдёт каждому место.",
    tag: "ORDER IN THE CHAOS",
    graphic: "grid",
  },
  {
    number: "02",
    title: "FREE\nPOSITIONING",
    text: "Выходите за рамки ячеек. Добавляйте декор, вращайте элементы и управляйте слоями.",
    tag: "BREAK THE GRID",
    graphic: "free",
  },
  {
    number: "03",
    title: "YOUR STYLE.\nYOUR CHOICE.",
    text: "Ваши цвета, шрифты, фоны и формы. От чистого минимализма до цифрового коллажа.",
    tag: "MAKE IT PERSONAL",
    graphic: "style",
  },
  {
    number: "04",
    title: "ALL YOUR\nMEDIA.",
    text: "Ссылки, изображения, GIF, текст, видео и музыка. Всё, из чего складывается ваш интернет.",
    tag: "MIX. MATCH. REPEAT.",
    graphic: "media",
  },
];
export function Home() {
  return (
    <div className="home-page">
      <a className="skip-link" href="#home-main">
        К содержимому
      </a>
      <nav className="home-nav" aria-label="Основная навигация">
        <Brand />
        <span className="nav-edition">
          INDEPENDENT WEB TOOL
          <br />
          <b>EST. 2026 — BUILT FOR YOU</b>
        </span>
        <a className="nav-anchor" href="#playground">
          Песочница <ArrowDownRight size={13} />
        </a>
        <Link
          className="secondary-button"
          to="/editor"
          aria-label="Открыть редактор"
        >
          OPEN EDITOR <ArrowUpRight size={17} />
        </Link>
      </nav>
      <main id="home-main">
        <section className="hero">
          <div className="hero-meta">
            <span>
              <span className="tiny-dot" />
              UNLOCK_YOUR_INTERNET
            </span>
            <span>NO ALGORITHM. JUST YOU. [01—∞]</span>
          </div>
          <div className="hero-heading">
            <h1>
              YOUR INTERNET.
              <br />
              YOUR{" "}
              <span className="rules-word">
                RULES<span className="title-period">.</span>
              </span>
            </h1>
            <Starburst className="hero-star" />
            <span className="hero-sticker" aria-hidden="true">
              NOT ANOTHER
              <br />
              <b>LINK IN BIO.</b>
            </span>
          </div>
          <div className="hero-bottom">
            <div className="hero-sidenote">
              <span className="barcode" aria-hidden="true" />
              <span>
                PERSONAL SPACE
                <br />
                NOT A TEMPLATE.
              </span>
            </div>
            <p>
              Хватит помещать себя в чужие шаблоны.
              <br />
              Соберите свой уголок интернета из ссылок,
              <br />
              фотографий, видео и немного хаоса.
            </p>
            <div className="hero-action">
              <Link
                className="primary-button hero-button"
                to="/editor"
                aria-label="Создать своё пространство"
              >
                START CREATING <ArrowUpRight size={27} />
              </Link>
              <span>
                <Check size={12} /> Без регистрации. Сохраняется у вас.
              </span>
            </div>
          </div>
          <a className="hero-scroll" href="#playground">
            SCROLL TO EXPLORE <ArrowDown size={14} />
          </a>
        </section>
        <div
          className="manifesto-strip"
          aria-label="The internet is your canvas. Make it yours."
        >
          <span>THE INTERNET IS YOUR CANVAS.</span>
          <Starburst className="strip-star" />
          <span>MAKE IT YOURS.</span>
          <ArrowUpRight size={35} />
          <span className="strip-extra" aria-hidden="true">
            THE INTERNET IS YOUR CANVAS.
          </span>
        </div>
        <section
          className="product-section"
          id="playground"
          aria-labelledby="product-title"
        >
          <div className="product-intro">
            <div className="section-kicker">[ 01 / THE PLAYGROUND ]</div>
            <h2 id="product-title">
              LESS BIO.
              <br />
              MORE <span>YOU.</span>
            </h2>
            <p>
              Это не карточка профиля.
              <br />
              Это ваша территория.
            </p>
            <div className="product-steps">
              <div>
                <span>01</span>
                <p>
                  Добавьте то,
                  <br />
                  что вам важно.
                </p>
              </div>
              <div>
                <span>02</span>
                <p>
                  Расположите так,
                  <br />
                  как нравится вам.
                </p>
              </div>
              <div>
                <span>03</span>
                <p>
                  Сохраните.
                  <br />
                  Сделайте по-своему.
                </p>
              </div>
            </div>
            <div className="product-note">
              <MoveUpRight size={24} />
              <p>
                Это живая песочница.
                <br />
                Попробуйте двигать блоки.
              </p>
            </div>
          </div>
          <div className="product-demo">
            <div className="demo-caption">
              <span>YOUR PAGE / YOUR RULES</span>
              <span>6 BLOCK TYPES + FREE DECOR</span>
            </div>
            <Showcase />
            <p className="sandbox-note">
              Изменения в примере не затрагивают вашу страницу.{" "}
              <Link to="/editor">Открыть свой редактор ↗</Link>
            </p>
          </div>
        </section>
        <section
          className="features-section"
          id="features"
          aria-labelledby="features-title"
        >
          <div className="section-header">
            <span className="section-kicker">[ 02 / THE TOOLKIT ]</span>
            <h2 id="features-title">
              SMALL TOOL.
              <br />
              <span>BIG POSSIBILITIES.</span>
            </h2>
            <span className="section-cross" aria-hidden="true">
              +
            </span>
          </div>
          <div className="feature-grid">
            {features.map((feature) => (
              <article
                className={`feature feature-kind-${feature.graphic}`}
                key={feature.number}
              >
                <div className="feature-top">
                  <span>{feature.number}</span>
                  <span>{feature.tag}</span>
                </div>
                <div
                  className={`feature-art ${feature.graphic}-art`}
                  aria-hidden="true"
                >
                  {feature.graphic === "grid" ? (
                    <>
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </>
                  ) : feature.graphic === "free" ? (
                    <>
                      <i>
                        <Starburst />
                      </i>
                      <span>
                        OUTSIDE
                        <br />
                        THE BOX.
                      </span>
                      <MoveUpRight size={20} />
                    </>
                  ) : feature.graphic === "style" ? (
                    <>
                      <i>Aa</i>
                      <span />
                      <span />
                      <span />
                    </>
                  ) : (
                    <>
                      <i>GIF</i>
                      <span>▶</span>
                      <span>↗</span>
                    </>
                  )}
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="final-cta">
          <div className="cta-meta">
            <span>[ 03 / YOUR MOVE ]</span>
            <span>PERSONAL INTERNET SPACE</span>
          </div>
          <div className="cta-content">
            <h2>
              DON’T FIT IN.
              <br />
              <span>BUILD OUT.</span>
            </h2>
            <div>
              <p>
                Интернету не нужен ещё один одинаковый профиль.
                <br />
                Ему нужен ваш.
              </p>
              <Link className="ink-button" to="/editor">
                MAKE IT YOURS <ArrowUpRight size={24} />
              </Link>
            </div>
          </div>
          <div className="cta-bottom">
            <span>YOUR LINKS. YOUR WORLD. YOUR CANVAS.</span>
            <span aria-hidden="true">+++++</span>
          </div>
        </section>
      </main>
      <footer className="home-footer">
        <Brand />
        <p>
          Независимый инструмент.
          <br />
          Для тех, кто делает по-своему.
        </p>
        <Link to="/preview">
          Мой предпросмотр <ArrowUpRight size={14} />
        </Link>
        <span className="footer-edition">
          © 2026 LINK/CANVAS
          <br />
          LOCAL FIRST. ALWAYS YOURS.
        </span>
      </footer>
    </div>
  );
}
