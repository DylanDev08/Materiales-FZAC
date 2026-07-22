import type { NextConfig } from "next";

const rawAdminPath = process.env.ADMIN_CONSOLE_PATH?.trim() || "/fzac-admin-crs-2026";
const normalizedAdminPath = rawAdminPath.replace(/^\/+|\/+$/g, "");
const adminConsolePath = normalizedAdminPath ? `/${normalizedAdminPath}` : "/fzac-admin-crs-2026";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "res.cloudinary.com" }
    ]
  },
  async redirects() {
    const redirects = [
      {
        source: "/register",
        destination: "/registro",
        permanent: false
      },
      {
        source: "/admin",
        destination: adminConsolePath,
        permanent: false
      },
      {
        source: "/admin/:path*",
        destination: `${adminConsolePath}/:path*`,
        permanent: false
      }
    ];
    if (adminConsolePath === "/admin") return redirects.slice(0, 1);
    return redirects;
  },
  async rewrites() {
    return [
      {
        source: `${adminConsolePath}/:path*`,
        destination: "/admin/:path*"
      }
    ];
  }
};

export default nextConfig;
