export function youtubeVideo(url: URL): URL | null {
  if (url.host === 'youtu.be') {
    const id = url.pathname.slice(1);
    if (!id) return null;
    return new URL(`https://www.youtube.com/watch?v=${id}`);
  }
  if (
    url.host === 'www.youtube.com' ||
    url.host === 'youtube.com' ||
    url.host === 'm.youtube.com'
  ) {
    if (url.pathname !== '/watch') return null;
    const v = url.searchParams.get('v');
    if (!v) return null;
    return new URL(`https://www.youtube.com/watch?v=${v}`);
  }
  return null;
}
