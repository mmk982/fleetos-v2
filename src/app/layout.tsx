import type { Metadata } from "next";
import { Inter, Tajawal } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "FleetOS",
  description: "Fleet compliance management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${tajawal.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <ThemeProvider>
          {/*
            Dialogs portal to body and mark this shell inert so the
            page behind is removed from the tab/AT order while open.
          */}
          <div data-app-shell className="flex min-h-full flex-1 flex-col">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
