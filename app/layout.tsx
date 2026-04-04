import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sliding Numbers - Logic Game",
  description: "Mind-bending sliding tile puzzle - arrange numbers in order",
  metadataBase: new URL("https://puzzle.buttsstudios.com"),
  openGraph: {
    type: "website",
    url: "https://puzzle.buttsstudios.com",
    title: "Sliding Numbers - Logic Game",
    description: "Mind-bending sliding tile puzzle - arrange numbers in order",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Sliding Numbers Game",
      },
    ],
    siteName: "Butts Studios",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@buttsstudios",
    creator: "@buttsstudios",
    title: "Sliding Numbers - Logic Game",
    description: "Mind-bending sliding tile puzzle - arrange numbers in order",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  themeColor: "#9C27B0",
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
