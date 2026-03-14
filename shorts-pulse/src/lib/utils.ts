export function parseDurationToSeconds(iso: string): number {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || '0') * 3600) + (parseInt(m[2] || '0') * 60) + parseInt(m[3] || '0');
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return '--';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}

export function timeAgo(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return mins + 'm ago';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  return days + 'd ago';
}

export function hoursAge(dateStr: string): number {
  return (new Date().getTime() - new Date(dateStr).getTime()) / 3600000;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getThumbnail(snippet: any): string {
  return snippet?.thumbnails?.maxres?.url
    || snippet?.thumbnails?.high?.url
    || snippet?.thumbnails?.medium?.url
    || snippet?.thumbnails?.default?.url
    || '';
}
