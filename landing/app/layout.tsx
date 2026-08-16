import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
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

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  const title = "Titi — Fale do seu jeito. O PC entende e faz.";
  const description = "IA local para Windows que entende linguagem natural, acompanha o contexto e transforma sua voz em ações no computador.";
  return {
    metadataBase: base,
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "pt_BR",
      images: [{ url: "/og-v3.png", width: 1732, height: 909, alt: "Titi — Fale do seu jeito. O PC entende e faz." }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/og-v3.png"] },
    icons: { icon: "/titi-icon.png", shortcut: "/titi-icon.png" },
  };
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
