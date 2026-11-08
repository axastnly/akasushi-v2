import PageVeil from "@/components/PageVeil";

/* Re-mounts on every navigation (unlike layout.tsx) — that's what drives the
   page transition's fade-in. No wrapper element, so page layout/stacking is
   untouched. */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageVeil />
      {children}
    </>
  );
}
