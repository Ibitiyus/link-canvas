import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { searchGallery } from "./api";
import type { GalleryCard } from "./model";
import { GalleryCover } from "./GalleryCover";
import { ServiceArrow } from "../components/ui/ServiceArrow";

export function ExploreSelection() {
  const [cards, setCards] = useState<GalleryCard[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    void searchGallery("", "", "updated", 0, "home", controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setCards(result.items.slice(0, 3));
        setStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
  }, [attempt]);
  return (
    <section className="riot-samples" aria-labelledby="samples-title">
      <span className="riot-tag">EXPLORE / СТРАНИЦЫ АВТОРОВ</span>
      <h2 id="samples-title">
        СОБРАНО В ZIN.
        <br />
        <span className="cutword red">ПО-СВОЕМУ.</span>
      </h2>
      {status === "loading" ? (
        <p role="status">Загружаем подборку…</p>
      ) : status === "error" ? (
        <div className="home-gallery-message">
          <p role="status">Подборка временно недоступна.</p>
          <button
            className="secondary-button"
            onClick={() => setAttempt((x) => x + 1)}
          >
            Повторить
          </button>
        </div>
      ) : cards.length ? (
        <div className="riot-sample-grid">
          {cards.map((card) => (
            <Link
              className="riot-sample"
              key={card.username}
              to={`/u/${card.username}`}
            >
              <span className="riot-micro">
                @{card.username} / {card.category}
              </span>
              <h3>
                {card.title} <ServiceArrow />
              </h3>
              <GalleryCover card={card} />
              {card.description && <p>{card.description}</p>}
              <span className="riot-micro">
                ОТКРЫТЬ ZIN <ServiceArrow />
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="home-gallery-message">
          Здесь появятся страницы, авторы которых поделились ими в Explore.
        </p>
      )}
      <Link className="secondary-button home-gallery-link" to="/explore">
        Смотреть все ZIN <ServiceArrow />
      </Link>
    </section>
  );
}
