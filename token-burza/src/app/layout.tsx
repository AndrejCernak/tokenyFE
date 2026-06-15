import "./globals.css";
import type { Metadata } from "next";
import { FrappeAuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Burza piatkových tokenov",
  description: "1 token = 60 min v piatok",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sk">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        <FrappeAuthProvider>{children}</FrappeAuthProvider>
      </body>
    </html>
  );
}
