import "./globals.css";
import type { Metadata } from "next";
import Nav from "@/components/nav";

export const metadata: Metadata = {
  title: "Transporter",
  description: "Post shipments, post capacity, bid, award. Phase 1.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
