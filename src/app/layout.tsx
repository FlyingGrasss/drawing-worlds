import type { Metadata } from "next";
import { Fredoka, Inter } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const fredoka = Fredoka({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Drawing Worlds — arkadaşlarınla aynı tuvalde çiz",
  description:
    "Rastgele bir dünya aç, bağlantıyı arkadaşlarına gönder; aynı tuvalde birlikte çiz. Hesap yok, kurulum yok — sadece bir bağlantı ve biraz renk.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="tr" className={`${inter.variable} ${fredoka.variable}`}>
      <body className="min-h-dvh antialiased">
        <a className="skip-link" href="#main">
          İçeriğe geç
        </a>
        {children}
      </body>
    </html>
  );
}
