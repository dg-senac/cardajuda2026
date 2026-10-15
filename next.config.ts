import type { NextConfig } from "next";

// As Server Actions do Next comparam o header `Origin` (mandado pelo navegador)
// com o header `Host`. Atrás de proxy/preview (ex.: https://3000-xxx.e2b.app)
// os dois divergem e o Next aborta com "Invalid Server Actions request." (E80).
// allowedOrigins libera essas origens confiáveis.
//
// O APK (Capacitor) NÃO precisa de entrada aqui: ele abre o sistema publicado no
// próprio endereço do servidor, então `Origin` e `Host` são o mesmo host. Quem
// muda de host em runtime é só a tela de configuração do app (www/index.html),
// que é HTML local e não usa Server Actions.
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "127.0.0.1:3000", "*.e2b.app"],
    },
  },
};

export default nextConfig;
