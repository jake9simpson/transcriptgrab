import type { Metadata } from "next";
import ThemeToggle from "@/components/ThemeToggle";
import AuthButton from "@/components/AuthButton";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "TranscriptGrab",
  description: "Extract YouTube transcripts instantly — no ads, no API keys",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')})()`,
          }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <Providers>
          <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
              <span className="text-lg font-semibold tracking-tight">TranscriptGrab</span>
              <div className="flex items-center gap-2">
                <AuthButton />
                <ThemeToggle />
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-4xl px-4 py-8">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
