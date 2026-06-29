import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ClientLayoutWrapper from "@/components/ClientLayoutWrapper";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { OfflineBanner } from "@/components/OfflineBanner";
import { BranchProvider } from "@/context/BranchContext";
import { LanguageProvider } from "@/context/LanguageContext";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Circle K Franchise - Financial reporting & Verification System",
  description: "Enterprise level POS, fuel operations, inventory reporting and validation system for Circle K retail stores.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CK Cashier"
  },
  icons: {
    icon: "/icons8-circled-k-50.png",
    apple: "/apple-icon.png",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/icons8-circled-k-50.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons8-circled-k-50.png" />
        <meta name="apple-mobile-web-app-title" content="CK Cashier" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans transition-colors duration-300">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <BranchProvider>
            <LanguageProvider>
              <div className="fixed bottom-4 right-4 z-50 print:hidden">
                <ThemeToggle />
              </div>
              <OfflineBanner />
              <ClientLayoutWrapper>{children}</ClientLayoutWrapper>
              <Toaster position="top-center" richColors closeButton theme="system" />
            </LanguageProvider>
          </BranchProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
