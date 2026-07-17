import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: {
    disableDevLogs: true,
  },
  fallbacks: {
    document: "/cashier",
  },
});

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {},
};

export default withPWA(nextConfig);

