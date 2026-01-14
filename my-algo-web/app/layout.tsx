import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Algo Online",
  description: "Deduce the numbers and outsmart your opponent in this logical card battle game.",
  openGraph: {
    title: "Algo Online",
    description: "Deduce the numbers and outsmart your opponent in this logical card battle game.",
    url: "https://my-algo-web.pages.dev",
    siteName: "Algo Online",
    images: [
      {
        url: "https://my-algo-web.pages.dev/logo.svg", // Placeholder or real image
        width: 1200,
        height: 630,
        alt: "Algo Online Game Board",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Algo Online",
    description: "Join the battle of logic and deduction!",
    images: ["https://my-algo-web.pages.dev/logo.svg"], // Placeholder
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
