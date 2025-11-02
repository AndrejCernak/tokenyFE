import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";

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
    <ClerkProvider>
      <html lang="sk">
        <body className="min-h-screen bg-white text-neutral-900 antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
