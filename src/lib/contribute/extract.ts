/**
 * Cut the `<xm-exam-statistics>` block out of a saved TUMonline page.
 *
 * Runs in the browser before anything is sent, so the rest of the page — including the uploader's
 * name in the header — never leaves their computer. The server runs it again on whatever it
 * receives. Plain string search instead of DOMParser so the same code runs in Node and the browser.
 */
export const MAX_FRAGMENT_BYTES = 512 * 1024;

export function extractStatisticsBlock(html: string): string | null {
  const start = html.search(/<xm-exam-statistics[\s>]/i);
  if (start === -1) return null;
  const close = /<\/xm-exam-statistics\s*>/i.exec(html.slice(start));
  if (!close) return null;
  return html.slice(start, start + close.index + close[0].length);
}
