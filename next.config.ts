import type { NextConfig } from "next";

const rawAdminPath = process.env.ADMIN_CONSOLE_PATH?.trim() || "/fzac-admin-crs-2026";
const normalizedAdminPath = rawAdminPath.replace(/^\/+|\/+$/g, "");
const adminConsolePath = normalizedAdminPath ? `/${normalizedAdminPath}` : "/fzac-admin-crs-2026";

const nextConfig: NextConfig = {
  webpack(config, { dev, isServer }) {
    if (!dev && !isServer) {
      // Render's edge can refuse bursts of HTTP/2 streams; route bundles favor reliability over speculative chunking.
      config.optimization.splitChunks = false;
    }
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "*.mitiendanube.com" },
      { protocol: "https", hostname: "*.tiendanube.com" },
      { protocol: "https", hostname: "*.cloudfront.net" }
    ]
  },
  async redirects() {
    const redirects = [
      {
        source: "/productos.html",
        destination: "/productos",
        permanent: true
      },
      {
        source: "/carrito.html",
        destination: "/carrito",
        permanent: true
      },
      {
        source: "/mis-pedidos.html",
        destination: "/cuenta/pedidos",
        permanent: true
      },
      {
        source: "/cliente-login.html",
        destination: "/login",
        permanent: true
      },
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
    if (adminConsolePath === "/admin") return redirects.slice(0, 5);
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
