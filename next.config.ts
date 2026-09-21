import type { NextConfig } from "next";

const rawAdminPath = process.env.ADMIN_CONSOLE_PATH?.trim() || "/fzac-admin-crs-2026";
const normalizedAdminPath = rawAdminPath.replace(/^\/+|\/+$/g, "");
const adminConsolePath = normalizedAdminPath ? `/${normalizedAdminPath}` : "/fzac-admin-crs-2026";
const isRenderDeployment = Boolean(process.env.RENDER_EXTERNAL_HOSTNAME);

function getApiProxyOrigin() {
  const raw = process.env.API_PROXY_ORIGIN?.trim() || (process.env.VERCEL === "1" ? "https://materiales-fzac.onrender.com" : "");
  if (!raw) return "";

  const url = new URL(raw);
  const isLocalHttp =
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);

  if ((url.protocol !== "https:" && !isLocalHttp) || url.username || url.password) {
    throw new Error("API_PROXY_ORIGIN debe ser un origen HTTPS valido y sin credenciales.");
  }

  return url.origin;
}

const apiProxyOrigin = getApiProxyOrigin();

const nextConfig: NextConfig = {
  webpack(config, { dev, isServer }) {
    if (!dev && !isServer && isRenderDeployment) {
      // Render's edge can refuse bursts of HTTP/2 streams; keep this workaround scoped to Render.
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
  async headers() {
    if (!apiProxyOrigin) return [];
    return [
      {
        source: "/api/:path*",
        headers: [{ key: "x-vercel-enable-rewrite-caching", value: "0" }]
      }
    ];
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
    const adminRewrite = {
      source: `${adminConsolePath}/:path*`,
      destination: "/admin/:path*"
    };

    if (!apiProxyOrigin) return [adminRewrite];

    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${apiProxyOrigin}/api/:path*`
        }
      ],
      afterFiles: [adminRewrite],
      fallback: []
    };
  }
};

export default nextConfig;
