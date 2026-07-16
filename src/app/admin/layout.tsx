import { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/manifest-manager.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ANH Manager",
  },
  icons: {
    icon: "/icon-manager.png",
    apple: "/icon-manager.png",
  }
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
