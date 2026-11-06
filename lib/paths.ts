/* Next.js's `basePath` (next.config.ts) only auto-prefixes its own
   managed elements (next/image, next/link, next/script) — plain
   <img src="...">, <video src="...">, and fetch() calls with a
   hand-written path never get it, so every reference to a /public asset
   needs this helper or it 404s once deployed under /akasushi-v2/. Kept as a
   plain constant (not an env var) since it must exactly match
   next.config.ts's basePath and there's no reason for it to vary at
   runtime. */
export const BASE_PATH = "/akasushi-v2";

export function asset(path: string): string {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}
