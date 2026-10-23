import { useEffect } from "react";
/** Client metadata only: crawler rendering depends on JS; there is no SSR here. */
export function useExploreMetadata() {
  useEffect(() => {
    const title = document.title;
    document.title = "Галерея ZIN — откройте чужие творческие миры";
    const saved: (() => void)[] = [];
    for (const [attribute, name, content] of [
      [
        "name",
        "description",
        "Откройте авторские ZIN: искусство, музыка, фотографии и личные цифровые миры.",
      ],
      ["property", "og:title", "Галерея ZIN"],
      [
        "property",
        "og:description",
        "Страницы независимых авторов. Найдите свой следующий источник вдохновения.",
      ],
      ["property", "og:url", `${location.origin}/explore`],
      ["property", "og:type", "website"],
    ]) {
      const existing = document.head.querySelector<HTMLMetaElement>(
        `meta[${attribute}="${name}"]`,
      );
      const element = existing ?? document.createElement("meta"),
        old = element.getAttribute("content");
      element.setAttribute(attribute, name);
      element.content = content;
      if (!existing) document.head.append(element);
      saved.push(() => {
        if (!existing) element.remove();
        else if (old !== null) element.content = old;
        else element.removeAttribute("content");
      });
    }
    return () => {
      document.title = title;
      saved.forEach((restore) => restore());
    };
  }, []);
}
