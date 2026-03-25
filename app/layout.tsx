import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Butts Puzzle - Logic Game",
  description: "Mind-bending puzzles that challenge your logic and problem-solving skills.",
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
