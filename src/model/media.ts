/** Only http(s) URLs are rendered as links, images or media. */
export function safeUrl(value: string): string | null {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}
export type VideoSource = { kind: 'youtube' | 'file'; src: string };
export function videoSource(value: string): VideoSource | null {
  const safe = safeUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  const host = url.hostname.toLowerCase();
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host)) {
    id = url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(embed|shorts|live)\//.test(url.pathname) ? url.pathname.split('/')[2] : null;
  }
  if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}` };
  if (/\.(mp4|webm|ogv|ogg)$/i.test(url.pathname)) return { kind: 'file', src: safe };
  return null;
}
