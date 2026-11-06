"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import ReserveModal from "./ReserveModal";

type ReserveModalContextValue = {
  openReserve: () => void;
};

const ReserveModalContext = createContext<ReserveModalContextValue | null>(null);

/* Lightweight context instead of this project's usual module-singleton
   pattern (see getLenis() in lib/motion.ts) — that pattern works for
   imperative APIs, but the modal's open/closed state has to be reactive
   to actually show/hide React-rendered markup. */
export function useReserveModal(): ReserveModalContextValue {
  const ctx = useContext(ReserveModalContext);
  if (!ctx) throw new Error("useReserveModal must be used within ReserveModalProvider");
  return ctx;
}

export default function ReserveModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const openReserve = useCallback(() => setIsOpen(true), []);
  const closeReserve = useCallback(() => setIsOpen(false), []);
  const value = useMemo(() => ({ openReserve }), [openReserve]);

  return (
    <ReserveModalContext.Provider value={value}>
      {children}
      <ReserveModal isOpen={isOpen} onClose={closeReserve} />
    </ReserveModalContext.Provider>
  );
}
