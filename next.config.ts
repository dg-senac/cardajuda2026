import type { NextConfig } from "next";

// As Server Actions do Next comparam o header `Origin` (mandado pelo navegador)
// com o header `Host`. Atrás de proxy/preview (ex.: https://3000-xxx.e2b.app)
// os dois divergem e o Next aborta com "Invalid Server Actions request." (E80).
// allowedOrigins libera essas origens confiáveis.
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "127.0.0.1:3000",
        "*.e2b.app",
        "com.cardajuda.app",
      ],
    },
  },
};

export default nextConfig;
