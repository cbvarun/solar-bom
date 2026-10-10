import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Left to the runtime bundler so each target picks its own build: on
  // Cloudflare the Prisma client resolves to its WebAssembly (workerd) variant.
  serverExternalPackages: ["exceljs", "@prisma/client", ".prisma/client", "@prisma/adapter-pg", "pg"],
  poweredByHeader: false,
  webpack(config, { isServer }) {
    // PDFs are built in the browser only. Keep the 2.5 MB pdfkit bundle out of
    // the server build, where the client export code is also compiled for SSR.
    if (isServer) config.resolve.alias = { ...config.resolve.alias, "pdfkit/js/pdfkit.standalone": false };
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
