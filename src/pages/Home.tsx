import { useAuth } from "../auth/AuthContext";
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
    title: "РЕДАКТОР\nНА СЕТКЕ",
    text: "Собирайте страницу из блоков. Перемещайте, меняйте размеры — сетка найдёт каждому место.",
    tag: "ПОРЯДОК В ХАОСЕ",
    graphic: "grid",
  },
  {
    number: "02",
    title: "СВОБОДНОЕ\nРАЗМЕЩЕНИЕ",
    text: "Выходите за рамки ячеек. Добавляйте декор, вращайте элементы и управляйте слоями.",
    tag: "ЗА РАМКАМИ СЕТКИ",
    graphic: "free",
  },
  {
    number: "03",
    title: "ВАШ СТИЛЬ.\nВАШ ВЫБОР.",
    text: "Ваши цвета, шрифты, фоны и формы. От чистого минимализма до цифрового коллажа.",
    tag: "ДОБАВЬТЕ СЕБЯ",
    graphic: "style",
  },
  {
    number: "04",
    title: "ВСЕ ВАШИ\nМЕДИА.",
    text: "Ссылки, изображения, GIF, текст, видео и музыка. Всё, из чего складывается ваш интернет.",
    tag: "СОЧЕТАЙТЕ. ПРОБУЙТЕ.",
    graphic: "media",
  },
];
export function Home() {
  const { session } = useAuth();
  return (
    <div className="home-page">
      <a className="skip-link" href="#home-main">
        К содержимому
      </a>
      <nav className="home-nav" aria-label="Основная навигация">
        <Brand />
        <span className="nav-edition">
          НЕЗАВИСИМЫЙ РЕДАКТОР
          <br />
          <b>С 2026 ГОДА — ДЛЯ ВАС</b>
        </span>
        <a className="nav-anchor" href="#playground">
          Песочница <ArrowDownRight size={13} />
        </a>
        <Link
          className="secondary-button"
          to="/editor"
          aria-label="Открыть редактор"
        >
          ОТКРЫТЬ РЕДАКТОР <ArrowUpRight size={17} />
        </Link>
        <Link className="home-account" to="/dashboard">{session?"Мой аккаунт":"Войти"}</Link>
      </nav>
      <main id="home-main">
        <section className="hero">
          <div className="hero-meta">
            <span>
              <span className="tiny-dot" />
              ОТКРОЙТЕ СВОЙ ИНТЕРНЕТ
            </span>
            <span>БЕЗ АЛГОРИТМОВ. ТОЛЬКО ВЫ. [01—∞]</span>
          </div>
          <div className="hero-heading">
            <h1>
              ВАШ ИНТЕРНЕТ.
              <br />
              ВАШИ{" "}
              <span className="rules-word">
                ПРАВИЛА<span className="title-period">.</span>
              </span>
            </h1>
            <Starburst className="hero-star" />
            <span className="hero-sticker" aria-hidden="true">
              БОЛЬШЕ, ЧЕМ
              <br />
              <b>ССЫЛКА В ПРОФИЛЕ.</b>
            </span>
          </div>
          <div className="hero-bottom">
            <div className="hero-sidenote">
              <span className="barcode" aria-hidden="true" />
              <span>
                ЛИЧНОЕ ПРОСТРАНСТВО
                <br />
                БЕЗ ШАБЛОНОВ.
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
                СОЗДАТЬ СВОЁ ПРОСТРАНСТВО <ArrowUpRight size={27} />
              </Link>
              <span>
                <Check size={12} /> Без регистрации. Сохраняется у вас.
              </span>
            </div>
          </div>
          <a className="hero-scroll" href="#playground">
            УЗНАТЬ БОЛЬШЕ <ArrowDown size={14} />
          </a>
        </section>
        <div
          className="manifesto-strip"
          aria-label="Интернет — ваше полотно. Создайте своё."
        >
          <span>ИНТЕРНЕТ — ВАШЕ ПОЛОТНО.</span>
          <Starburst className="strip-star" />
          <span>СОЗДАЙТЕ СВОЁ.</span>
          <ArrowUpRight size={35} />
          <span className="strip-extra" aria-hidden="true">
            ИНТЕРНЕТ — ВАШЕ ПОЛОТНО.
          </span>
        </div>
        <section
          className="product-section"
          id="playground"
          aria-labelledby="product-title"
        >
          <div className="product-intro">
            <div className="section-kicker">[ 01 / ПЕСОЧНИЦА ]</div>
            <h2 id="product-title">
              МЕНЬШЕ РАМОК.
              <br />
              БОЛЬШЕ <span>ВАС.</span>
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
              <span>ВАША СТРАНИЦА / ВАШИ ПРАВИЛА</span>
              <span>7 ТИПОВ БЛОКОВ + СВОБОДНЫЙ ДЕКОР</span>
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
            <span className="section-kicker">[ 02 / ИНСТРУМЕНТЫ ]</span>
            <h2 id="features-title">
              ПРОСТОЙ РЕДАКТОР.
              <br />
              <span>БОЛЬШИЕ ВОЗМОЖНОСТИ.</span>
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
                        ВНЕ
                        <br />
                        РАМОК.
                      </span>
                      <MoveUpRight size={20} />
                    </>
                  ) : feature.graphic === "style" ? (
                    <>
                      <i>Аа</i>
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
            <span>[ 03 / ВАШ ХОД ]</span>
            <span>ВАШЕ МЕСТО В ИНТЕРНЕТЕ</span>
          </div>
          <div className="cta-content">
            <h2>
              НЕ ПОДСТРАИВАЙТЕСЬ.
              <br />
              <span>СОЗДАВАЙТЕ СВОЁ.</span>
            </h2>
            <div>
              <p>
                Интернету не нужен ещё один одинаковый профиль.
                <br />
                Ему нужен ваш.
              </p>
              <Link className="ink-button" to="/editor">
                СОЗДАТЬ СВОЮ СТРАНИЦУ <ArrowUpRight size={24} />
              </Link>
            </div>
          </div>
          <div className="cta-bottom">
            <span>ВАШИ ССЫЛКИ. ВАШ МИР. ВАШЕ ПОЛОТНО.</span>
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
          © 2026 ZIN
          <br />
          ХРАНИТСЯ У ВАС. ПРИНАДЛЕЖИТ ВАМ.
        </span>
      </footer>
    </div>
  );
}
