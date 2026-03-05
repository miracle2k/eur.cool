import type { Metadata } from "next";
import Script from "next/script";
import { Archivo_Black, Space_Mono } from "next/font/google";
import "./globals.css";

const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
});

const display = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "eur.cool > The EUR stablecoin ecosystem overview",
  description: "Live issuance tracker for EUR stablecoins",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${mono.variable} ${display.variable}`}>
        <Script
          defer
          data-domain="eur.cool"
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
        {children}
      </body>
    </html>
  );
}
