import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig = {
  reactStrictMode: false,
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "framer-motion",
      "sonner",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
      "clsx",
      "tailwind-merge",
      "chart.js",
      "react-chartjs-2",
      "exceljs",
      "jspdf",
      "jspdf-autotable",
      "papaparse",
      "canvas-confetti"
    ],
  },
  async headers() {
    return [
      {
        source: "/:all*(svg|jpg|png|webp|ico|woff|woff2|ttf|mp3)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/financials/inputs/overview",
        destination: "/financials/inputs",
        permanent: true,
      },
    ];
  },
  turbopack: {},
};

export default withPWA(nextConfig);

