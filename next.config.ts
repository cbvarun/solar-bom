import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Left to the runtime bundler so each target picks its own build: on
  // Cloudflare the Prisma client resolves to its WebAssembly (workerd) variant.
  serverExternalPackages: ["pdfkit", "exceljs", "@prisma/client", ".prisma/client", "@prisma/adapter-pg", "pg"],
  poweredByHeader: false,
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
