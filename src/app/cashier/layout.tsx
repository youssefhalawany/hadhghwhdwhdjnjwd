import { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/manifest-cashier.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ANH Cashier",
  },
  icons: {
    icon: "/icon-cashier.png",
    apple: "/icon-cashier.png",
  }
};

export default function CashierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
