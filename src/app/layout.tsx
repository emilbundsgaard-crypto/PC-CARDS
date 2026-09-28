import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OSU P-Card Audit Tool",
  description:
    "Internal audit tool for Oklahoma State University purchasing-card transactions: natural-language querying and prohibited-purchase review.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
