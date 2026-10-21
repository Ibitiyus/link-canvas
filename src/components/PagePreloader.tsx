import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import "../styles/preloader.css";

type Begin = () => (failed?: boolean) => void;
const LoadingContext = createContext<Begin | null>(null);
export const usePageLoading = () => useContext(LoadingContext);

/** Keep media mounted while the initial composition loads; never restart playback. */
export function PagePreloader({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const tasks = useRef(new Set<symbol>());
  const failures = useRef(new Set<unknown>());
  const notify = useRef(() => {});
  const [loading, setLoading] = useState(true);
  const [slow, setSlow] = useState(false);
  const [errors, setErrors] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const begin = useCallback<Begin>(() => {
    const token = Symbol();
    tasks.current.add(token);
    notify.current();
    return (failed = false) => {
      if (!tasks.current.delete(token)) return;
      if (failed) failures.current.add(token);
      notify.current();
    };
  }, []);

  useEffect(() => {
    const done = begin();
    const frame = requestAnimationFrame(() =>
      document.fonts.ready.then(
        () => done(),
        () => done(true),
      ),
    );
    return () => {
      cancelAnimationFrame(frame);
      done();
    };
  }, [begin]);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    let finished = false;
    let quiet: ReturnType<typeof setTimeout>;
    const frames = new WeakSet<Element>();
    const scan = () => {
      if (finished) return;
      clearTimeout(quiet);
      let pending = tasks.current.size;
      for (const element of node.querySelectorAll(
        "img, video, audio, iframe",
      )) {
        if (!element.getAttribute("src")) continue;
        if (element instanceof HTMLImageElement) {
          if (!element.complete) pending++;
          else if (!element.naturalWidth) failures.current.add(element);
        } else if (element instanceof HTMLMediaElement) {
          // Wait for the first video frame / audio metadata, never an entire stream.
          if (element.error) failures.current.add(element);
          else if (
            element.readyState <
            (element instanceof HTMLVideoElement
              ? HTMLMediaElement.HAVE_CURRENT_DATA
              : HTMLMediaElement.HAVE_METADATA)
          )
            pending++;
        } else if (
          !frames.has(element) &&
          (element as HTMLElement).dataset.zinLoaded !== "true"
        )
          pending++;
      }
      setErrors(failures.current.size);
      if (!pending)
        quiet = setTimeout(() => {
          finished = true;
          setLoading(false);
        }, 100);
    };
    const settled = (event: Event) => {
      if (event.target instanceof HTMLIFrameElement) frames.add(event.target);
      if (event.type === "error" && event.target instanceof Element)
        failures.current.add(event.target);
      scan();
    };
    notify.current = scan;
    const observer = new MutationObserver(scan);
    observer.observe(node, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "data-zin-loaded"],
    });
    for (const event of ["load", "error", "loadedmetadata", "loadeddata"])
      node.addEventListener(event, settled, true);
    scan();
    const timeout = setTimeout(() => setSlow(true), 30000);
    return () => {
      finished = true;
      notify.current = () => {};
      observer.disconnect();
      clearTimeout(quiet);
      clearTimeout(timeout);
      for (const event of ["load", "error", "loadedmetadata", "loadeddata"])
        node.removeEventListener(event, settled, true);
    };
  }, []);

  return (
    <LoadingContext value={begin}>
      {loading && (
        <div className="zin-preloader" role="status" aria-live="polite">
          <strong>
            ZIN<span aria-hidden="true">✦</span>
          </strong>
          <p>Загружаем ваш зин…</p>
          <span className="zin-loading-bar" aria-hidden="true" />
          {slow && (
            <div className="zin-loading-help">
              <p>Некоторые элементы загружаются дольше обычного.</p>
              <button onClick={() => location.reload()}>
                Повторить загрузку
              </button>
              <button onClick={() => setLoading(false)}>
                Открыть уже загруженное
              </button>
            </div>
          )}
        </div>
      )}
      <div
        ref={root}
        className={loading ? "zin-page-pending" : "zin-page-ready"}
        inert={loading}
        aria-busy={loading}
      >
        {children}
      </div>
      {!loading && errors > 0 && !dismissed && (
        <div className="zin-loading-error" role="status">
          Часть медиа недоступна.{" "}
          <button onClick={() => location.reload()}>Повторить загрузку</button>{" "}
          <button onClick={() => setDismissed(true)}>Скрыть сообщение</button>
        </div>
      )}
    </LoadingContext>
  );
}
