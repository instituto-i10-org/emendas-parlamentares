import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fixa a raiz do workspace neste projeto. Sem isto, o Next infere a raiz
  // pelo lockfile de C:\Users\pc e emite aviso (há múltiplos package-lock.json).
  turbopack: {
    root: import.meta.dirname,
  },
  // Leitura de PDF no servidor: carregadas do node_modules, sem empacotar.
  serverExternalPackages: ["pdfjs-dist", "pdf-lib"],
  // Não vaza detalhes de framework.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
