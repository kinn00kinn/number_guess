import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
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
  title: "Binarily",
  description:
    "Deduce the numbers and outsmart your opponent in this logical card battle game.",
  openGraph: {
    title: "Binarily",
    description:
      "Deduce the numbers and outsmart your opponent in this logical card battle game.",
    url: "https://binarily.kinn-kinn.com",
    siteName: "Binarily",
    images: [
      {
        url: "https://binarily.kinn-kinn.com/logo.svg", // Placeholder or real image
        width: 1200,
        height: 630,
        alt: "Binarily Game Board",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Binarily",
    description: "Join the battle of logic and deduction!",
    images: ["https://binarily.kinn-kinn.com/logo.svg"], // Placeholder
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = "G-CVN8J6X8NN";

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
      {gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}');
            `}
          </Script>
        </>
      )}
    </html>
  );
}
