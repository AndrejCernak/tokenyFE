// src/app/layout.tsx
import "./globals.css";
import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
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
        <body className="min-h-screen bg-gradient-to-br from-stone-100 via-emerald-50 to-amber-50 text-stone-800">
          {/* HEADER */}
          <header className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-white/70 backdrop-blur">
            <h1 className="text-xl font-semibold">Burza piatkových tokenov</h1>
            <div>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="px-4 py-2 rounded-xl bg-emerald-600 text-white shadow hover:bg-emerald-700 transition">
                    Prihlásiť sa
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </div>
          </header>

          {/* MAIN CONTENT */}
          <main className="max-w-5xl mx-auto p-6">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
