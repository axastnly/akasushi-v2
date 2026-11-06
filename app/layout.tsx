import "./globals.css";

export const metadata = {
  title: "AKA — Restaurant & Lounge · Mileo The Palm, Dubai",
  description:
    "Not every door leads to a place. Some lead to a story. AKA Restaurant & Lounge, Mileo The Palm, Dubai.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
