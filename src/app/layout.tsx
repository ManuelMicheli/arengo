import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// La piattaforma parla in Bricolage Grotesque.
const bricolage = localFont({
  src: "./fonts/bricolage-grotesque-latin-wght-normal.woff2",
  weight: "200 800",
  display: "swap",
  variable: "--font-bricolage",
});

// Le persone parlano in Newsreader: problemi, proposte, argomenti, Piazza.
const newsreader = localFont({
  src: [
    { path: "./fonts/newsreader-latin-opsz-normal.woff2", weight: "200 800", style: "normal" },
    { path: "./fonts/newsreader-latin-opsz-italic.woff2", weight: "200 800", style: "italic" },
  ],
  display: "swap",
  variable: "--font-newsreader",
});

// Segni a margine: al massimo uno per schermata, mai per informazioni essenziali.
const reenie = localFont({
  src: "./fonts/reenie-beanie-latin-400-normal.woff2",
  weight: "400",
  display: "swap",
  variable: "--font-reenie",
  preload: false,
});

export const metadata: Metadata = {
  title: "Arengo",
  description: "Discutere di politica per trovare soluzioni condivise.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className={`${bricolage.variable} ${newsreader.variable} ${reenie.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
