import type { Metadata } from "next";
import { Playfair_Display, Urbanist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const urbanist = Urbanist({
  variable: "--font-urbanist",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Reality Check",
  description: "Zoom out. See the bigger picture.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${urbanist.variable} ${playfair.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="relative min-h-full flex flex-col bg-background text-foreground font-sans">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}