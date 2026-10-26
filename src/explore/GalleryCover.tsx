import { useEffect, useState } from "react";
import { CATEGORIES, type GalleryCard } from "./model";
import { ServiceArrow } from "../components/ui/ServiceArrow";

/** Author covers have a typographic fallback, including on an image decode error. */
export function GalleryCover({ card }: { card: GalleryCard }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [card.cover]);
  return (
    <div
      className={`explore-cover cover-${CATEGORIES.indexOf(card.category) % 4}`}
    >
      {card.cover && !failed ? (
        <img
          src={card.cover}
          alt={`Обложка автора: ${card.title}`}
          loading="lazy"
          decoding="async"
          width={480}
          height={300}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="explore-type-cover" aria-hidden="true">
          <span>ZIN / {card.category}</span>
          <strong>{card.title}</strong>
          <span>
            @{card.username} <ServiceArrow />
          </span>
        </div>
      )}
      <span className="explore-cover-label">
        {card.cover && !failed ? "ОБЛОЖКА АВТОРА" : "БЕЗ ОБЛОЖКИ"}
      </span>
    </div>
  );
}
