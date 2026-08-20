import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function generateMetadata(): Metadata {
  const base = configuredSiteBase();
  const socialImage = base ? new URL("/og-brand.png", base).href : undefined;
  const title = "Titi — Fale do seu jeito. O PC entende e faz.";
  const description = "IA local para Windows que entende linguagem natural, acompanha o contexto e transforma sua voz em ações no computador.";
  return {
    ...(base ? { metadataBase: base } : {}),
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "pt_BR",
      ...(socialImage ? { images: [{ url: socialImage, width: 1731, height: 909, alt: "Titi — Fale do seu jeito. O PC entende e faz." }] } : {}),
    },
    twitter: { card: "summary_large_image", title, description, ...(socialImage ? { images: [socialImage] } : {}) },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
        { url: "/titi-icon-192.png", type: "image/png", sizes: "192x192" },
      ],
      shortcut: "/favicon.ico",
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
  };
}

function configuredSiteBase(): URL | undefined {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return undefined;
  const url = new URL(configured);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("NEXT_PUBLIC_SITE_URL deve ser uma origem HTTPS canônica.");
  }
  url.pathname = "/";
  return url;
}

export const viewport: Viewport = {
  themeColor: "#f3f0e8",
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
