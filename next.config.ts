import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
    optimizePackageImports: [
      "@hugeicons/core-free-icons",
      "@hugeicons/react",
      "recharts",
    ],
  },

  async headers() {
    // Build CSP connect-src for Supabase Auth/Realtime
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    let connectSrc = "'self'";

    if (supabaseUrl) {
      try {
        const { hostname } = new URL(supabaseUrl);
        // Include https:// and wss:// for specific hostname + fallback wildcard
        connectSrc += ` https://${hostname} wss://${hostname} https://*.supabase.co wss://*.supabase.co`;
      } catch {
        // Invalid URL, use wildcard fallback only
        connectSrc += " https://*.supabase.co wss://*.supabase.co";
      }
    } else {
      // No env var, use wildcard fallback
      connectSrc += " https://*.supabase.co wss://*.supabase.co";
    }

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `connect-src ${connectSrc}`,
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "style-src 'self' 'unsafe-inline'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
