/* Tiny on-page error log for debugging on devices with no attached
   inspector (e.g. an iPhone over LAN) — gated behind ?debug in the URL,
   see components/DebugPanel.tsx. */

export type DebugEntry = { time: number; message: string };

const entries: DebugEntry[] = [];
const listeners = new Set<(entries: DebugEntry[]) => void>();

export function logDebug(message: string) {
  console.error(message);
  entries.push({ time: Date.now(), message });
  if (entries.length > 30) entries.shift();
  const snapshot = entries.slice();
  listeners.forEach((l) => l(snapshot));
}

export function subscribeDebug(listener: (entries: DebugEntry[]) => void) {
  listeners.add(listener);
  listener(entries.slice());
  return () => {
    listeners.delete(listener);
  };
}
