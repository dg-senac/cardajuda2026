"use client";

import { useSyncExternalStore } from "react";

/** Nada muda depois do carregamento: o user agent é fixo. */
const SEM_ASSINATURA = () => () => {};
const NO_SERVIDOR = () => false;

/**
 * "Trocar servidor" dentro do APK.
 *
 * O aplicativo Android guarda o endereço do servidor na tela de configuração
 * embutida (`www/index.html`, servida em https://localhost). Depois de conectar,
 * a WebView passa a mostrar o sistema publicado -- e não sobra nenhum botão do
 * Capacitor para voltar e corrigir um endereço errado.
 *
 * Este link resolve isso: aparece SÓ quando a página está rodando dentro do APK
 * (o user agent leva a marca "CardaAjudaApp", configurada em
 * capacitor.config.json -> appendUserAgent) e leva de volta à tela local com
 * `?trocar=1`, que abre o formulário de endereço.
 */
export default function TrocarServidor({ className = "" }: { className?: string }) {
  // useSyncExternalStore é a forma correta de ler algo que só existe no
  // navegador sem quebrar a hidratação (no servidor a resposta é sempre `false`,
  // e no cliente o React troca o valor logo depois de montar).
  const dentroDoApp = useSyncExternalStore(
    SEM_ASSINATURA,
    () => /CardaAjudaApp/i.test(window.navigator.userAgent),
    NO_SERVIDOR,
  );

  if (!dentroDoApp) return null;

  return (
    <button
      type="button"
      className={`text-[11px] font-bold text-primaria underline ${className}`}
      onClick={() => {
        window.location.href = "https://localhost/index.html?trocar=1";
      }}
    >
      Trocar servidor
    </button>
  );
}
