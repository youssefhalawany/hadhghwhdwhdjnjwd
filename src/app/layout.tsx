import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ClientLayoutWrapper from "@/components/ClientLayoutWrapper";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { OfflineBanner } from "@/components/OfflineBanner";
import { DynamicIsland } from "@/components/MobileUX/DynamicIsland";
import { SuccessOverlay } from "@/components/MobileUX/SuccessOverlay";
import { BranchProvider } from "@/context/BranchContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { BrandProvider } from "@/context/BrandContext";
import { CommandBar } from "@/components/CommandBar";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Circle K Franchise - Financial reporting & Verification System",
  description: "Enterprise level POS, fuel operations, inventory reporting and validation system for Circle K retail stores.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0B1121"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="min-h-screen w-full overflow-hidden print:overflow-visible print:min-h-0 flex flex-col bg-background text-foreground font-sans transition-colors duration-300">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <BrandProvider>
            <BranchProvider>
              <LanguageProvider>
                <div className="fixed bottom-4 right-4 z-50 print:hidden">
                  <ThemeToggle />
                </div>
                <OfflineBanner />
                <DynamicIsland />
                <SuccessOverlay />
                <CommandBar />
                <ClientLayoutWrapper>{children}</ClientLayoutWrapper>
                <Toaster position="top-center" richColors closeButton theme="system" />
              </LanguageProvider>
            </BranchProvider>
          </BrandProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
