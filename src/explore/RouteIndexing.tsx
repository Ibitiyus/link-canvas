import { useEffect } from "react";
import { useLocation } from "react-router-dom";
/** Private application screens are not search results, even for JS-aware crawlers. */
export function RouteIndexing() {
  const { pathname } = useLocation();
  useEffect(() => {
    const element = document.createElement("meta");
    element.name = "robots";
    element.content = [
      "/editor",
      "/preview",
      "/dashboard",
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
    ].some((route) => pathname.replace(/\/+$/, "") === route)
      ? "noindex, nofollow"
      : "index, follow";
    document.head.append(element);
    return () => element.remove();
  }, [pathname]);
  return null;
}
