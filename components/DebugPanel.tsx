"use client";

import { useEffect, useState } from "react";
import { subscribeDebug, type DebugEntry } from "@/lib/debugLog";

/* Only renders with ?debug in the URL — an on-screen error log for
   checking a phone with no attached inspector. */
export default function DebugPanel() {
  const [enabled, setEnabled] = useState(false);
  const [entries, setEntries] = useState<DebugEntry[]>([]);

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("debug")) return;
    setEnabled(true);
    return subscribeDebug(setEntries);
  }, []);

  if (!enabled) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: "40vh",
        overflowY: "auto",
        background: "rgba(0,0,0,0.88)",
        color: "#6f6",
        font: "11px/1.5 ui-monospace, Menlo, monospace",
        padding: "8px 10px",
        zIndex: 999999,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      <div style={{ color: "#fff", marginBottom: 4 }}>debug ({entries.length})</div>
      {entries.length === 0 && <div>no errors logged</div>}
      {entries.map((e, i) => (
        <div key={i}>
          [{new Date(e.time).toLocaleTimeString()}] {e.message}
        </div>
      ))}
    </div>
  );
}
